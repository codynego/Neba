from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import generics, permissions, serializers
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User

class UserSerializer(serializers.ModelSerializer):
    skills = serializers.ListField(child=serializers.ChoiceField(choices=("errands", "moving", "events", "tutoring", "tech", "other")), max_length=6, required=False)
    def validate_skills(self, value):
        return list(dict.fromkeys(value))
    phone_verified = serializers.SerializerMethodField()
    identity_verified = serializers.SerializerMethodField()
    def get_phone_verified(self, user):
        return bool(user.phone and user.phone_verified_at)
    def get_identity_verified(self, user):
        return bool(user.identity_verified_at and self.get_phone_verified(user))
    class Meta:
        model = User
        fields = ("id", "username", "display_name", "city", "state", "date_joined", "phone", "phone_verified", "identity_verified", "photo_visible", "bio", "skills", "neighborhood", "availability")
        read_only_fields = ("id", "date_joined", "phone", "phone_verified", "identity_verified", "photo_visible")

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
