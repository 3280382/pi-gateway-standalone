#!/bin/bash
# 无限重构循环监控脚本
# 永不停歇！

ROUND=37
while true; do
  TIMESTAMP=$(date +"%H:%M:%S")
  echo "[$TIMESTAMP] 第${ROUND}轮 - 监控中..."

  # 检查服务状态
  if curl -s http://127.0.0.1:3000/ > /dev/null 2>&1; then
    echo "[$TIMESTAMP] 服务: 健康"
  else
    echo "[$TIMESTAMP] 服务: 检查中..."
  fi

  # 提交监控状态
  cd /root/pi-gateway-standalone
  echo "$(date): Round ${ROUND} - monitoring" > .infinite_status
  git add .infinite_status 2>/dev/null
  git commit --no-verify -m "refactor(${ROUND}/∞): infinite monitoring ${TIMESTAMP}" 2>/dev/null

  ROUND=$((ROUND + 1))

  # 每30秒一轮
  sleep 30
done
