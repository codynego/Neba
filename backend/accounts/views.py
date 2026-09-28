from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import generics, permissions, serializers
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "display_name", "city", "state", "date_joined")
        read_only_fields = ("id", "date_joined")

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
        request.auth.delete()
        return Response(status=204)
