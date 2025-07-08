import os
from pathlib import Path
from dotenv import load_dotenv

# ✅ app/.env 파일을 찾도록 경로 수정
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

print("✅ .env 경로:", ENV_PATH)
print("✅ GOOGLE_APPLICATION_CREDENTIALS:", os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not cred_path:
    raise ValueError("❌ GOOGLE_APPLICATION_CREDENTIALS 환경변수가 비어있습니다!")

from google.oauth2 import service_account
from google.cloud import firestore

credentials = service_account.Credentials.from_service_account_file(cred_path)
db = firestore.Client(credentials=credentials)

print("✅ Firestore 클라이언트 생성 완료:", type(db))
