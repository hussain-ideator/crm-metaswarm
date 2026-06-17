from __future__ import annotations

from asgiref.sync import sync_to_async
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView
from adrf.views import APIView

from .serializers import CustomTokenObtainPairSerializer

REFRESH_COOKIE = 'refresh_token'
REFRESH_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


class TokenObtainPairView(BaseTokenObtainPairView):
    """Return access token in body; set refresh token as httpOnly cookie."""

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            refresh = response.data.pop('refresh', None)
            if refresh:
                response.set_cookie(
                    REFRESH_COOKIE,
                    refresh,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite='Lax',
                    max_age=REFRESH_MAX_AGE,
                )
        return response


class TokenRefreshView(BaseTokenRefreshView):
    """Read refresh token from httpOnly cookie if not provided in body."""

    permission_classes = [AllowAny]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        refresh = request.COOKIES.get(REFRESH_COOKIE)
        if refresh and 'refresh' not in request.data:
            request._full_data = {'refresh': refresh}  # type: ignore[attr-defined]
        return super().post(request, *args, **kwargs)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    async def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                await sync_to_async(token.blacklist)()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(REFRESH_COOKIE)
        return response
