import os
import json
import requests
import traceback
from app.database.firebase import db
import concurrent.futures

print("✅ summarizer.py 불러옴")
print("✅ 불러온 db 클라이언트 타입:", type(db))
print("🔍 summarizer.py에서 불러온 DB 객체:", db)

def summarize_by_hospital(hospital_id: str) -> str:
    print("\n📌 summarize_by_hospital() 진입")
    print("📌 요약 대상 hospital_id:", hospital_id)

    try:
        print("🕐 Firestore get() 실행 전")
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(
                lambda: db.collection("hospitals").document(hospital_id).collection("completed_cases").get()
            )
            print("🕐 Firestore get() 실행 중 (대기)...")
            snapshots = future.result(timeout=5)
            print("✅ Firestore 응답 수신 완료:", len(snapshots))
    except concurrent.futures.TimeoutError:
        print("❌ Firestore get() 타임아웃 발생")
        return "❌ Firestore에서 데이터를 읽는 데 시간이 너무 오래 걸립니다."
    except Exception as e:
        print("❌ Firestore 예외:", str(e))
        traceback.print_exc()
        return "❌ Firestore에서 데이터를 읽는 데 실패했습니다."

    if not snapshots:
        print("📌 완료된 환자 문서가 존재하지 않음")
        return "❗️해당 병원의 완료된 환자 데이터가 없습니다."

    patient_data = []
    print(f"📑 수신한 문서 개수: {len(snapshots)}")
    for doc in snapshots:
        data = doc.to_dict()
        print("📄 문서 내용:", data)
        accepted_at = data.get("acceptedAt")
        patient_info = data.get("patientInfo")

        if accepted_at and patient_info:
            print("✅ 필터 통과:", accepted_at, patient_info)
            entry = {
                "acceptedAt": str(accepted_at),
                "age": patient_info.get("age"),
                "gender": patient_info.get("gender"),
                "symptom": patient_info.get("symptom")
            }
            patient_data.append(entry)
        else:
            print("⚠️ 필터에서 제외됨:", accepted_at, patient_info)

    if not patient_data:
        print("📌 필터링된 유효 환자 데이터 없음")
        return "❗️해당 병원의 환자 정보가 부족합니다."

    # ✅ 병원 ID 로그 추가
    print("🧪 이 데이터는 다음 병원 ID에 기반합니다:", hospital_id)

    # ✅ 환자 JSON 출력
    print("📦 Gemini에 전달된 환자 JSON ↓↓↓")
    print(json.dumps(patient_data, indent=2, ensure_ascii=False))


    prompt = (
        "아래는 병원에 방문한 환자들의 JSON 데이터입니다.\n"
        "이 데이터를 바탕으로 다음 3가지를 분석하여 출력해주세요:\n"
        "1. 시간대별 환자 수 (실제 존재하는 항목만)\n"
        "2. 연령대별 환자 수 (실제 존재하는 항목만)\n"
        "3. 증상에 따른 진료과목 (중복 제거)\n\n"

        "💡 출력 형식은 아래 예시처럼 간결하고 보기 좋게 정리해주세요.\n"
        "(AcceptedAt 기준)도 지워주세요\n"
        "**불필요한 설명 없이 형식만 지켜 출력**해주세요.\n\n"

        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "📊 시간대별 환자 수 (AcceptedAt 기준)\n"
        "🕐 00:00 ~ 05:59 → N명\n"
        "🕐 06:00 ~ 11:59 → N명\n"
        "🕐 12:00 ~ 17:59 → N명\n"
        "🕐 18:00 ~ 23:59 → N명\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "👶 연령대별 환자 수\n"
        "• 10대 → N명\n"
        "• 20대 → N명\n"
        "• 30대 → N명\n"
        "(※ 실제 데이터가 존재하는 항목만)\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "🩺 증상별 진료과목 추천\n"
        "• 오른쪽 다리 골절 → 정형외과\n"
        "• 가슴 통증 → 순환기내과\n"
        "• 복통 → 소화기내과\n"
        "(※ 중복은 제거하고 하나씩만)\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "📌 아래 JSON 데이터를 기반으로 분석하되, **응답에는 절대 JSON 데이터를 포함하지 마세요.**\n"
    )
    prompt += json.dumps(patient_data, ensure_ascii=False, indent=2)
    prompt += (
        "\n\n🛑 위 JSON 데이터는 **분석에만 사용**하세요. "
        "**답변에는 절대 JSON 원문을 출력하지 마세요.** "
        "오직 요청된 분석 내용만 출력하세요."
    )



    print("🧠 Gemini 프롬프트 준비 완료")
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": os.getenv("GEMINI_API_KEY")
    }
    body = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    if not headers["X-Goog-Api-Key"]:
        print("❌ Gemini API 키가 환경변수에 없음")
        return "❌ Gemini API 키가 설정되지 않았습니다."

    try:
        print("📡 Gemini API 호출 중...")
        response = requests.post(url, headers=headers, json=body, timeout=15)
        print("📬 Gemini 응답 수신 완료")
        response.close()


        if response.status_code != 200:
            print("❌ Gemini 상태 코드 오류:", response.status_code)
            print("❌ 응답 내용:", response.text)
            return f"❌ Gemini 오류 발생: {response.status_code}\n{response.text}"

        data = response.json()
        result = data["candidates"][0]["content"]["parts"][0]["text"]
        print("📊 Gemini 결과 분석 완료")
        return result.strip()

    except requests.exceptions.Timeout:
        print("❌ Gemini 요청 시간 초과")
        return "❌ Gemini 요청이 시간 초과로 실패했습니다."
    except Exception as e:
        print("❌ Gemini 예외 발생:", str(e))
        traceback.print_exc()
        return f"❌ Gemini 요청 실패: {str(e)}"
