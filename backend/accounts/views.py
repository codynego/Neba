import io
import uuid
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, UnidentifiedImageError
from botocore.exceptions import BotoCoreError, ClientError
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Organization, ProfileDocument, User
from . import r2
from .trust import normalize_phone
from .emailing import EmailUnavailable, safely, send_password_reset_email, send_verification_email

class UserSerializer(serializers.ModelSerializer):
    skills = serializers.ListField(child=serializers.CharField(max_length=80), max_length=20, required=False)
    opportunity_interests = serializers.ListField(child=serializers.CharField(max_length=80), max_length=12, required=False)
    goals = serializers.ListField(child=serializers.CharField(max_length=80), max_length=12, required=False)
    def validate_skills(self, value):
        return list(dict.fromkeys(value))
    phone_verified = serializers.SerializerMethodField()
    identity_verified = serializers.SerializerMethodField()
    photo_available = serializers.SerializerMethodField()
    profile_complete = serializers.BooleanField(read_only=True)
    email_verified = serializers.SerializerMethodField()
    def get_phone_verified(self, user):
        return bool(user.phone and user.phone_verified_at)
    def get_identity_verified(self, user):
        return bool(user.identity_verified_at and self.get_phone_verified(user))
    def get_photo_available(self, user):
        return bool(user.profile_photo_key or user.profile_photo)
    def get_email_verified(self, user):
        return bool(user.email and user.email_verified_at)
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
        fields = ("id", "public_id", "username", "email", "email_verified", "display_name", "city", "state", "date_joined", "phone", "phone_verified", "identity_verified", "photo_visible", "photo_available", "profile_complete", "bio", "skills", "neighborhood", "address", "latitude", "longitude", "availability", "nearby_task_emails", "date_of_birth", "gender", "country", "education_level", "field_of_study", "institution", "graduation_year", "gpa", "employment_status", "years_experience", "industry", "opportunity_interests", "goals", "business_status", "financial_need", "business_name", "business_industry", "business_description", "business_website")
        read_only_fields = ("id", "public_id", "username", "email", "email_verified", "date_joined", "phone_verified", "identity_verified", "photo_available", "profile_complete")


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name", "organization_type", "website", "country", "location", "description", "contact_name", "contact_email", "status", "created_at", "updated_at", "verified_at")
        read_only_fields = ("id", "status", "created_at", "updated_at", "verified_at")

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter your organization name.")
        return value.strip()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    terms_accepted = serializers.BooleanField(write_only=True)
    display_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    username = serializers.CharField(required=False, write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    class Meta:
        model = User
        fields = ("username", "email", "display_name", "password", "phone", "terms_accepted")
    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value
    def validate_terms_accepted(self, value):
        if value is not True:
            raise serializers.ValidationError("Accept the Terms of Service and acknowledge the Privacy Notice to create an account.")
        return value
    def create(self, validated_data):
        validated_data.pop("terms_accepted")
        requested_username = validated_data.pop("username", "")
        base_username = slugify(requested_username or validated_data["email"].split("@", 1)[0])[:130] or "member"
        username = base_username
        suffix = 2
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username[:145]}-{suffix}"
            suffix += 1
        validated_data["username"] = username
        validated_data["display_name"] = validated_data.get("display_name") or requested_username or username
        phone = validated_data.get("phone", "")
        if phone:
            validated_data["phone"] = normalize_phone(phone)
        else:
            validated_data.pop("phone", None)
        return User.objects.create_user(terms_accepted_at=timezone.now(), legal_policy_version="2026-09-30", **validated_data)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        safely(send_verification_email, user)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data}, status=201)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"
    def post(self, request):
        identifier = str(request.data.get("identifier") or request.data.get("username") or "").strip()
        username = User.objects.filter(email__iexact=identifier).values_list("username", flat=True).first() if "@" in identifier else identifier
        user = authenticate(username=username, password=request.data.get("password"))
        if not user:
            return Response({"detail": "Invalid username or password."}, status=400)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self):
        return self.request.user


class OrganizationView(generics.RetrieveUpdateAPIView):
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        organization, _ = Organization.objects.get_or_create(owner=self.request.user, defaults={"name": ""})
        return organization

    def perform_update(self, serializer):
        organization = serializer.save()
        if organization.status == Organization.Status.DRAFT and organization.name and organization.contact_email:
            organization.status = Organization.Status.PENDING
            organization.save(update_fields=("status", "updated_at"))

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=204)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get("email"))
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            safely(send_password_reset_email, user)
        return Response({"detail": "If an active account uses that email, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        try:
            user_id = force_str(urlsafe_base64_decode(request.data.get("uid", "")))
            user = User.objects.get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
            user = None
        token = str(request.data.get("token", ""))
        if not user or not default_token_generator.check_token(user, token):
            raise ValidationError("This password reset link is invalid or has expired.")
        password = serializers.CharField(write_only=True).run_validation(request.data.get("password"))
        try:
            validate_password(password, user=user)
        except DjangoValidationError as error:
            raise ValidationError(error.messages) from None
        user.set_password(password)
        user.save(update_fields=("password",))
        Token.objects.filter(user=user).delete()
        return Response({"detail": "Password updated. Sign in with your new password."})


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "email_verification"

    def post(self, request):
        try:
            user_id = force_str(urlsafe_base64_decode(request.data.get("uid", "")))
            user = User.objects.get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
            user = None
        token = str(request.data.get("token", ""))
        if not user or not default_token_generator.check_token(user, token):
            raise ValidationError("This verification link is invalid or has expired.")
        if not user.email_verified_at:
            user.email_verified_at = timezone.now()
            user.save(update_fields=("email_verified_at",))
        return Response({"detail": "Email verified. Your account is now more secure."})


class ResendVerificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "email_verification"

    def post(self, request):
        if request.user.email_verified_at:
            return Response({"detail": "Your email is already verified."})
        try:
            send_verification_email(request.user)
        except EmailUnavailable:
            return Response({"detail": "Verification email is temporarily unavailable. Try again shortly."}, status=503)
        return Response({"detail": "Verification email sent."})


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
        request.user.save(update_fields=("profile_photo_key", "profile_photo_content_type"))
        if previous and previous != key:
            try:
                r2.delete_object(previous)
            except (BotoCoreError, ClientError):
                pass
        return Response(UserSerializer(request.user).data)


class ProfileDocumentSerializer(serializers.ModelSerializer):
    document_type_label = serializers.CharField(source="get_document_type_display", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ProfileDocument
        fields = ("public_id", "document_type", "document_type_label", "name", "content_type", "size", "created_at", "download_url")
        read_only_fields = fields

    def get_download_url(self, document):
        if not r2.configured():
            return None
        try:
            return r2.download_url(document.storage_key, document.name)
        except (BotoCoreError, ClientError):
            return None


class ProfileDocuments(APIView):
    permission_classes = [permissions.IsAuthenticated]
    allowed_types = {choice for choice, _ in ProfileDocument.DocumentType.choices}
    allowed_content_types = {
        "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain",
    }

    def get(self, request):
        return Response(ProfileDocumentSerializer(request.user.profile_documents.all(), many=True).data)

    def post(self, request):
        document_type = serializers.ChoiceField(choices=tuple(self.allowed_types)).run_validation(request.data.get("document_type"))
        name = serializers.CharField(max_length=180).run_validation(request.data.get("name"))
        content_type = serializers.CharField(max_length=120).run_validation(request.data.get("content_type"))
        size = serializers.IntegerField(min_value=1, max_value=10 * 1024 * 1024).run_validation(request.data.get("size"))
        if content_type not in self.allowed_content_types:
            raise ValidationError("Upload a PDF, Word document, spreadsheet, or text file.")
        extension = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
        if not r2.configured():
            raise R2Unavailable()
        key = f"profile-documents/{request.user.pk}/{uuid.uuid4().hex}.{extension}"
        try:
            upload_url = r2.upload_url(key, content_type)
        except (BotoCoreError, ClientError):
            raise R2Unavailable() from None
        return Response({"upload_url": upload_url, "key": key, "document_type": document_type, "name": name, "content_type": content_type, "size": size, "expires_in": 600})


class ProfileDocumentConfirm(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        key = serializers.CharField(max_length=300).run_validation(request.data.get("key"))
        prefix = f"profile-documents/{request.user.pk}/"
        if not key.startswith(prefix) or "/" in key[len(prefix):]:
            raise ValidationError("This upload does not belong to your profile.")
        try:
            metadata = r2.object_metadata(key)
            size = int(metadata.get("ContentLength", 0))
            content_type = str(metadata.get("ContentType", "")).lower()
            if not 0 < size <= 10 * 1024 * 1024 or content_type not in ProfileDocuments.allowed_content_types:
                raise ValidationError("The document type or size is not supported.")
        except ValidationError:
            try: r2.delete_object(key)
            except (BotoCoreError, ClientError): pass
            raise
        except (BotoCoreError, ClientError):
            raise ValidationError("The uploaded document could not be verified.") from None
        document_type = serializers.ChoiceField(choices=tuple(ProfileDocument.DocumentType.choices)).run_validation(request.data.get("document_type"))
        name = serializers.CharField(max_length=180).run_validation(request.data.get("name"))
        document = ProfileDocument.objects.create(user=request.user, document_type=document_type, name=name, storage_key=key, content_type=content_type, size=size)
        return Response(ProfileDocumentSerializer(document).data, status=201)


class ProfileDocumentDelete(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, public_id):
        document = ProfileDocument.objects.filter(user=request.user, public_id=public_id).first()
        if not document:
            raise ValidationError("Document not found.")
        try: r2.delete_object(document.storage_key)
        except (BotoCoreError, ClientError): pass
        document.delete()
        return Response(status=204)
