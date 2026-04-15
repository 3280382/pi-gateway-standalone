#!/usr/bin/env python3
"""
Hello World 脚本
一个简单的Python入门示例
"""

def main():
    """主函数"""
    # 打印Hello World消息
    print("Hello, World!")
    
    # 也可以打印其他信息
    name = "Python开发者"
    print(f"欢迎使用Python, {name}!")
    
    # 简单的计算示例
    a = 10
    b = 20
    result = a + b
    print(f"{a} + {b} = {result}")
    
    # 当前Python版本信息
    import sys
    print(f"Python版本: {sys.version}")


# 这是Python的标准入口点
if __name__ == "__main__":
    main()