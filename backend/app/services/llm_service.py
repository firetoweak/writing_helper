# llm_service.py
import httpx
import json  # 👈 必须导入 json
from typing import List, Dict, AsyncGenerator
from app.config import BASE_URL, DEEPSEEK_API_KEY

HEADERS = {
    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    "Content-Type": "application/json",
}

async def call_llm(model: str, messages: List[Dict[str, str]]) -> str:
    # 确保 URL 拼接正确，防止出现 //v1/v1 的情况
    api_url = f"{BASE_URL.rstrip('/')}/v1/chat/completions"
    
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            api_url,
            headers=HEADERS,
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "stream": False # 显式关闭流
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def call_llm_stream(
    model: str,
    messages: List[Dict[str, str]],
) -> AsyncGenerator[str, None]:
    
    api_url = f"{BASE_URL.rstrip('/')}/v1/chat/completions"

    async with httpx.AsyncClient(timeout=120) as client: # 流式建议超时设长一点
        async with client.stream(
            "POST",
            api_url,
            headers=HEADERS,
            json={
                "model": model,
                "messages": messages,
                "stream": True, # 开启流
                "temperature": 0.7, 
            },
        ) as response:
            async for line in response.aiter_lines():
                if not line:
                    continue
                
                # 1. 去除 data: 前缀
                if line.startswith("data:"):
                    line = line[5:].strip() # 去掉 'data:' (5个字符)
                
                # 2. 检查结束标记
                if line == "[DONE]":
                    break
                
                # 3. 解析 JSON 并提取文字
                try:
                    chunk = json.loads(line)
                    # OpenAI 格式的标准提取路径：choices[0].delta.content
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    
                    if content:
                        yield content  # 👈 关键：只 yield 纯文本！
                        
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    # print(f"解析错误: {e}") 
                    continue