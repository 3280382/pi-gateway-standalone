#!/bin/bash

# 修复所有导入路径
echo "修复导入路径..."

# 修复 store 导入
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|@/store/|@/stores/|g' {} \;

# 修复 api 导入
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|@/api/|@/services/api/|g' {} \;

# 修复 controllers 导入
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|@/controllers/|@/controllers/|g' {} \;

echo "导入路径修复完成"