from fastapi import FastAPI
from app.routers import writing

app = FastAPI(title="AI Writing Backend")

app.include_router(writing.router)
