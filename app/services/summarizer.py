'''
import os
import json
import requests
import traceback
import pytz
from datetime import timezone
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
            # ✅ UTC로 간주하고 timezone 설정
            if accepted_at.tzinfo is None:
                accepted_at = accepted_at.replace(tzinfo=timezone.utc)

            # ✅ KST로 변환
            accepted_at_kst = accepted_at.astimezone(pytz.timezone("Asia/Seoul"))
            accepted_at_str = accepted_at_kst.strftime("%Y-%m-%d %H:%M:%S")

            print("✅ 필터 통과:", accepted_at, patient_info)
            entry = {
                "acceptedAt": accepted_at_str,
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

    print("🧪 이 데이터는 다음 병원 ID에 기반합니다:", hospital_id)
    print("📦 Gemini에 전달된 환자 JSON ↓↓↓")
    print(json.dumps(patient_data, indent=2, ensure_ascii=False))

    prompt = (
        "아래는 병원에 방문한 환자들의 JSON 데이터입니다.\n"
        "이 데이터를 바탕으로 다음 4가지를 분석하여 출력해주세요:\n\n"

        "1. 시간대별 환자 수\n"
        "   - 반드시 아래 4개의 고정된 시간대만 사용하세요:\n"
        "     • 00:00 ~ 05:59\n"
        "     • 06:00 ~ 11:59\n"
        "     • 12:00 ~ 17:59\n"
        "     • 18:00 ~ 23:59\n"
        "   - 이 외의 시간 구간은 절대 생성하지 마세요.\n"
        "   - 각 환자의 `caseCompletedAt` 필드를 기준으로 해당 시간대를 판단하세요.\n"
        "   - 단, 환자가 존재하는 시간대만 출력하고, '0명'인 구간은 절대 출력하지 마세요.\n\n"

        "2. 연령대별 환자 수\n"
        "   - 기준: 6세 미만 → 영유아 / 6~9세 → 소아 / 10~19세 → 10대 / 20대, 30대, ... 순으로 출력하세요.\n"
        "   - `patientInfo.age` 값을 숫자로 변환하여 분석하고, 0명인 연령대는 절대 출력하지 마세요.\n\n"

        "3. 증상에 따른 진료과목 추천\n"
        "   - `patientInfo.symptom` 항목을 분석하여 의학적 증상만 포함하세요.\n"
        "   - 다음과 같은 표현은 제외하세요: 예) '보채고 축 늘어짐', '해열제 반응 없음', '39.5도 고열'\n"
        "   - 같은 증상에 대해 진료과가 중복되지 않도록 하나의 매핑만 출력하세요.\n\n"

        "4. 전체 분석 요약 (5~7줄 이내)\n"
        "   - 시간대 집중도, 주요 연령층, 흔한 증상, 필요한 진료과를 요약하세요.\n\n"

        "⚠️ 출력 시 반드시 아래 조건을 지켜야 합니다:\n"
        "- '0명'이라는 문구는 출력하지 마세요.\n"
        "- 'UTC', '24시간제', 'AcceptedAt 기준', 'caseCompletedAt 기준' 등의 표현도 절대 사용하지 마세요.\n"
        "- 시간대별, 연령대별, 증상별 환자 수의 총합이 서로 불일치하지 않도록 주의하세요.\n"
        "- JSON 원문은 출력하지 말고 분석에만 활용하세요.\n\n"

        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "📊 시간대별 환자 수\n"
        "🕐 00:00 ~ 05:59 → N명\n"
        "🕐 06:00 ~ 11:59 → N명\n"
        "🕐 12:00 ~ 17:59 → N명\n"
        "🕐 18:00 ~ 23:59 → N명\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "👶 연령대별 환자 수\n"
        "• 영유아 → N명\n"
        "• 10대 → N명\n"
        "• 20대 → N명\n"
        "• 30대 → N명\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "🩺 증상별 진료과목 추천\n"
        "• 골절 → 정형외과\n"
        "• 복통 → 소화기내과\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🧠 AI 분석 결과\n"
        "📌 위 환자 데이터를 바탕으로 분석한 요약 내용을 5~7줄 이내로 간결하게 작성하세요.\n"
        "요약에는 어떤 시간대가 집중되었는지, 어떤 연령/증상이 많았는지, 어떤 진료과가 필요한지 반드시 포함하세요.\n\n"
    )

    prompt += json.dumps(patient_data, ensure_ascii=False, indent=2)
    prompt += (
        "\n\n🛑 위 JSON 데이터는 분석용입니다. "
        "**답변에는 JSON 원문을 절대 포함하지 마세요.** "
        "요청된 분석 내용만 출력하세요."
        "⚠️ 추가 유의사항:\n"
            "- 시간대별, 연령대별, 증상별 환자 수의 총합이 항상 동일해야 하며, 분석에서 누락된 데이터가 없도록 하세요.\n"
            "- 단, 분석이 불가능한 데이터(예: 나이 없음, 시간 없음)는 '누락'이라고 표기하지 말고 **그냥 제외**하세요.\n"

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
'''

import os
import json
import requests
import traceback
import pytz
from datetime import timezone
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

    # ✅ 유효 데이터 필터링: caseCompletedAt과 숫자 age가 존재하는 경우만
    filtered_data = [
        doc.to_dict() for doc in snapshots
        if doc.to_dict().get("caseCompletedAt") and isinstance(doc.to_dict().get("patientInfo", {}).get("age"), (int, float))
    ]

    if not filtered_data:
        print("📌 유효한 환자 데이터가 존재하지 않음")
        return "❗️해당 병원의 유효한 환자 데이터가 없습니다."

    print(f"📑 필터링된 유효 문서 개수: {len(filtered_data)}")

    patient_data = []
    for data in filtered_data:
        completed_at = data.get("caseCompletedAt")
        patient_info = data.get("patientInfo")

        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)

        completed_at_kst = completed_at.astimezone(pytz.timezone("Asia/Seoul"))
        completed_at_str = completed_at_kst.strftime("%Y-%m-%d %H:%M:%S")

        entry = {
            "caseCompletedAt": completed_at_str,
            "age": patient_info.get("age"),
            "gender": patient_info.get("gender"),
            "symptom": patient_info.get("symptom")
        }
        patient_data.append(entry)

    print("📦 Gemini에 전달된 환자 JSON ↓↓↓")
    print(json.dumps(patient_data, indent=2, ensure_ascii=False))

    # ✅ 프롬프트 생성
    prompt = (
        "아래는 병원에 방문한 환자들의 JSON 데이터입니다.\n"
        "이 데이터를 바탕으로 다음 4가지를 분석하여 출력해주세요:\n\n"

        "1. 시간대별 환자 수\n"
        "   - 반드시 아래 4개의 고정된 시간대만 사용하세요:\n"
        "     • 00:00 ~ 05:59\n"
        "     • 06:00 ~ 11:59\n"
        "     • 12:00 ~ 17:59\n"
        "     • 18:00 ~ 23:59\n"
        "   - 이 외의 시간 구간은 절대 생성하지 마세요.\n"
        "   - 각 환자의 `caseCompletedAt` 필드를 기준으로 해당 시간대를 판단하세요.\n"
        "   - 단, 환자가 존재하는 시간대만 출력하고, '0명'인 구간은 절대 출력하지 마세요.\n\n"

        "2. 연령대별 환자 수\n"
        "   - 기준: 6세 미만 → 영유아 / 6~9세 → 소아 / 10~19세 → 10대 / 20대, 30대, ... 순으로 출력하세요.\n"
        "   - `patientInfo.age` 값을 숫자로 변환하여 분석하고, 0명인 연령대는 절대 출력하지 마세요.\n\n"

        "3. 증상에 따른 진료과목 추천\n"
        "   - `patientInfo.symptom` 항목을 분석하여 의학적 증상만 포함하세요.\n"
        "   - 다음과 같은 표현은 제외하세요: 예) '보채고 축 늘어짐', '해열제 반응 없음', '39.5도 고열'\n"
        "   - 같은 증상에 대해 진료과가 중복되지 않도록 하나의 매핑만 출력하세요.\n\n"

        "4. 전체 분석 요약 (5~7줄 이내)\n"
        "   - 시간대 집중도, 주요 연령층, 흔한 증상, 필요한 진료과를 요약하세요.\n\n"

        "⚠️ 출력 시 반드시 아래 조건을 지켜야 합니다:\n"
        "- '0명'이라는 문구는 출력하지 마세요.\n"
        "- 'UTC', '24시간제', 'AcceptedAt 기준', 'caseCompletedAt 기준' 등의 표현도 절대 사용하지 마세요.\n"
        "- 시간대별, 연령대별, 증상별 환자 수의 총합이 서로 불일치하지 않도록 주의하세요.\n"
        "- JSON 원문은 출력하지 말고 분석에만 활용하세요.\n\n"

        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "📊 시간대별 환자 수\n"
        "🕐 00:00 ~ 05:59 → N명\n"
        "🕐 06:00 ~ 11:59 → N명\n"
        "🕐 12:00 ~ 17:59 → N명\n"
        "🕐 18:00 ~ 23:59 → N명\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "👶 연령대별 환자 수\n"
        "• 영유아 → N명\n"
        "• 10대 → N명\n"
        "• 20대 → N명\n"
        "• 30대 → N명\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "🩺 증상별 진료과목 추천\n"
        "• 골절 → 정형외과\n"
        "• 복통 → 소화기내과\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🧠 AI 분석 결과\n"
        "📌 위 환자 데이터를 바탕으로 분석한 요약 내용을 5~7줄 이내로 간결하게 작성하세요.\n"
        "요약에는 어떤 시간대가 집중되었는지, 어떤 연령/증상이 많았는지, 어떤 진료과가 필요한지 반드시 포함하세요.\n\n"
    )

    prompt += json.dumps(patient_data, ensure_ascii=False, indent=2)
    prompt += (
        "\n\n🛑 위 JSON 데이터는 분석용입니다. "
        "**답변에는 JSON 원문을 절대 포함하지 마세요.** "
        "요청된 분석 내용만 출력하세요.\n"
        "⚠️ 추가 유의사항:\n"
        "- 시간대별, 연령대별, 증상별 환자 수의 총합은 반드시 JSON 데이터 수(총 " + str(len(patient_data)) + "명)와 일치해야 합니다.\n"
        "- 분석 불가능한 환자는 이미 제외되었으므로, 출력에서는 모두 반영되어야 합니다.\n"
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
