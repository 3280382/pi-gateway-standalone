#!/bin/bash

echo "修复所有导入路径..."

# 修复相对路径导入
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../../../../store/|from "@/stores/|g' {} \;
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../../../store/|from "@/stores/|g' {} \;
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../../store/|from "@/stores/|g' {} \;
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../store/|from "@/stores/|g' {} \;

# 修复奇怪的路径
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../@/services/api/|from "@/services/api/|g' {} \;

# 修复 api 相对路径
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../../../../services/api/|from "@/services/api/|g' {} \;
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../../../services/api/|from "@/services/api/|g' {} \;
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../../services/api/|from "@/services/api/|g' {} \;
find src/client -name "*.ts" -o -name "*.tsx" -exec sed -i 's|from "../services/api/|from "@/services/api/|g' {} \;

echo "导入路径修复完成"