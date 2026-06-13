import requests
import json
import sys

def test_parse_api(text: str):
    url = "http://127.0.0.1:8000/api/parse"
    payload = {
        "text": text
    }
    print(f"=========================================")
    print(f"🎙️ 发送指令: {text}")
    print(f"=========================================")
    try:
        response = requests.post(url, json=payload, timeout=15)
        response.raise_for_status()
        
        print("✅ 解析成功！返回的标准 CommandResponse:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except requests.exceptions.RequestException as e:
        print("❌ API 请求错误:", e)
        if hasattr(e, 'response') and e.response is not None:
            print("详细报错信息:", e.response.text)

if __name__ == "__main__":
    test_cases = [
        "画一个房子，有一个红色的三角形屋顶和蓝色的方形墙壁，还有一扇棕色的门",
        "把它往右上角移动一些，然后把它变成紫色的"
    ]
    
    if len(sys.argv) > 1:
        # 如果通过命令行传入参数则测试那句话
        test_parse_api(sys.argv[1])
    else:
        # 否则跑默认的复杂指令用例
        for case in test_cases:
            test_parse_api(case)
            print("\n")
