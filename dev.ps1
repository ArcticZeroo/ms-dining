# dev.ps1 - Opens a 2x2 grid in Windows Terminal
#
# Layout:
#   GitHub Copilot (top-left) | Client (top-right)
#   Terminal       (bot-left) | Server (bot-right)

$root = $PSScriptRoot

# 1. Split right → Client (top-right)
wt -w 0 split-pane --vertical --size 0.5 --title "Client" -d "$root\client" -- powershell -NoExit -Command "npm run dev"
Start-Sleep -Milliseconds 500

# 2. Split focused (Client) down → Server (bottom-right)
wt -w 0 split-pane --horizontal --size 0.5 --title "Server" -d "$root\server" -- powershell -NoExit -Command "npm run dev"
Start-Sleep -Milliseconds 500

# 3. Move focus back to the left column
wt -w 0 move-focus left
Start-Sleep -Milliseconds 300

# 4. Split this pane down → Terminal (bottom-left)
wt -w 0 split-pane --horizontal --size 0.5 --title "Terminal" -d "$root"
Start-Sleep -Milliseconds 500

# 5. Move focus back up to the top-left pane
wt -w 0 move-focus up
Start-Sleep -Milliseconds 300

# 6. Set pane title and launch ghcp in this pane
Write-Host "`e]0;GitHub Copilot`a" -NoNewline
npx -y @github/copilot@latest
