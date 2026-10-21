from fastapi.testclient import TestClient

from apps.api.main import app


def test_github_pages_origin_can_fetch_api():
    client = TestClient(app)

    response = client.options(
        "/api/master",
        headers={
            "Origin": "https://naveenjsdevops.github.io",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://naveenjsdevops.github.io"
