from __future__ import annotations

from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from adrf.views import APIView


class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    async def get(self, request: Request) -> Response:
        return Response({'status': 'ok'})
