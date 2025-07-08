from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from app.services.summarizer import summarize_by_hospital

router = APIRouter()

@router.get("/api/ai-summary")
async def get_summary(hospital_id: str = Query(...)):
    print("📥 /api/ai-summary 요청 도착")
    print(f"📌 요약 대상 hospital_id: {hospital_id}")

    result = summarize_by_hospital(hospital_id)
    return JSONResponse(content={"result": result})
