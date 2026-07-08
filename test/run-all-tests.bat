@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo.
echo ============================================================
echo   DevHome Workbench - 全面测试套件
echo ============================================================
echo.

node --no-deprecation test/run-all-tests.mjs

echo.
echo ============================================================
echo   测试完成！报告已输出至 test/docs/ 目录
echo   总览: test/docs/00-overview-report.md
echo ============================================================
pause
