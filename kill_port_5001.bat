@echo off
echo Killing all tasks running on port 5001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do taskkill /PID %%a /F
echo Done