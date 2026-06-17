from __future__ import annotations

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs: dict[str, str]) -> dict[str, object]:
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.pk,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
        }
        return data
