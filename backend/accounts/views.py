import io
import uuid
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from PIL import Image, UnidentifiedImageError
from botocore.exceptions import BotoCoreError, ClientError
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User
from . import r2
from .trust import normalize_phone

class UserSerializer(serializers.ModelSerializer):
    skills = serializers.ListField(child=serializers.ChoiceField(choices=("errands", "moving", "events", "tutoring", "tech", "other")), max_length=6, required=False)
    def validate_skills(self, value):
        return list(dict.fromkeys(value))
    phone_verified = serializers.SerializerMethodField()
    identity_verified = serializers.SerializerMethodField()
    photo_available = serializers.SerializerMethodField()
    profile_complete = serializers.BooleanField(read_only=True)
    def get_phone_verified(self, user):
        return bool(user.phone and user.phone_verified_at)
    def get_identity_verified(self, user):
        return bool(user.identity_verified_at and self.get_phone_verified(user))
    def get_photo_available(self, user):
        return bool(user.profile_photo_key or user.profile_photo)
    def validate_phone(self, value):
        return normalize_phone(value) if value else None
    def validate_latitude(self, value):
        if value is not None and not -90 <= value <= 90:
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value
    def validate_longitude(self, value):
        if value is not None and not -180 <= value <= 180:
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value
    class Meta:
        model = User
        fields = ("id", "public_id", "username", "display_name", "city", "state", "date_joined", "phone", "phone_verified", "identity_verified", "photo_visible", "photo_available", "profile_complete", "bio", "skills", "neighborhood", "address", "latitude", "longitude", "availability")
        read_only_fields = ("id", "public_id", "date_joined", "phone_verified", "identity_verified", "photo_visible", "photo_available", "profile_complete")

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    class Meta:
        model = User
        fields = ("username", "email", "display_name", "password", "city", "state")
    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        user = User.objects.get(username=response.data["username"])
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data}, status=201)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
        if not user:
            return Response({"detail": "Invalid username or password."}, status=400)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self):
        return self.request.user

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=204)


class R2Unavailable(APIException):
    status_code = 503
    default_detail = "Profile photo uploads are not available right now."


class ProfilePhotoUpload(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        content_type = serializers.ChoiceField(choices=("image/jpeg", "image/png", "image/webp")).run_validation(request.data.get("content_type"))
        size = serializers.IntegerField(min_value=1, max_value=5 * 1024 * 1024).run_validation(request.data.get("size"))
        if not r2.configured():
            raise R2Unavailable()
        extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
        key = f"profile-photos/{request.user.pk}/{uuid.uuid4().hex}.{extension}"
        try:
            url = r2.upload_url(key, content_type)
        except (BotoCoreError, ClientError):
            raise R2Unavailable() from None
        return Response({"upload_url": url, "key": key, "content_type": content_type, "max_size": 5 * 1024 * 1024, "expires_in": 600})


class ProfilePhotoConfirm(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        key = serializers.CharField(max_length=255).run_validation(request.data.get("key"))
        prefix = f"profile-photos/{request.user.pk}/"
        if not key.startswith(prefix) or "/" in key[len(prefix):]:
            raise ValidationError("This upload does not belong to your profile.")
        try:
            metadata = r2.object_metadata(key)
            size = int(metadata.get("ContentLength", 0))
            content_type = str(metadata.get("ContentType", "")).lower()
            if not 0 < size <= 5 * 1024 * 1024 or content_type not in ("image/jpeg", "image/png", "image/webp"):
                raise ValidationError("Choose a JPEG, PNG, or WebP photo under 5 MB.")
            raw = r2.object_bytes(key, 5 * 1024 * 1024)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format not in ("JPEG", "PNG", "WEBP") or getattr(image, "n_frames", 1) != 1:
                    raise ValidationError("Choose a still JPEG, PNG, or WebP photo.")
                if min(image.size) < 200 or max(image.size) > 6000 or image.width * image.height > 20_000_000:
                    raise ValidationError("Use a clear photo between 200 and 6000 pixels per side.")
                image.load()
        except ValidationError:
            try:
                r2.delete_object(key)
            except (BotoCoreError, ClientError):
                pass
            raise
        except (BotoCoreError, ClientError, UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            try:
                r2.delete_object(key)
            except (BotoCoreError, ClientError):
                pass
            raise ValidationError("The uploaded file could not be read as a safe photo.") from None
        previous = request.user.profile_photo_key
        request.user.profile_photo_key = key
        request.user.profile_photo_content_type = content_type
        request.user.photo_visible = True
        request.user.save(update_fields=("profile_photo_key", "profile_photo_content_type", "photo_visible"))
        if previous and previous != key:
            try:
                r2.delete_object(previous)
            except (BotoCoreError, ClientError):
                pass
        return Response(UserSerializer(request.user).data)
