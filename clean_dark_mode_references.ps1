# Script para limpiar referencias específicas del modo oscuro
# Ejecuta solo reemplazos simples y seguros

$files = @(
    "src\screens\limitNumero.js",
    "src\components\ChangePasswordModal.js", 
    "src\components\CleanerButton.js",
    "src\components\SideBar.js",
    "src\components\ScreenWrapper.js"
)

# Reemplazos seguros que solo eliminan propiedades isDarkMode
$replacements = @(
    @{
        Pattern = ', isDarkMode && styles\.\w+'
        Replacement = ''
    },
    @{
        Pattern = 'isDarkMode && styles\.\w+, '
        Replacement = ''
    },
    @{
        Pattern = '\[([^]]+), isDarkMode && styles\.\w+\]'
        Replacement = '[$1]'
    },
    @{
        Pattern = '\[isDarkMode && styles\.\w+, ([^]]+)\]'
        Replacement = '[$1]'
    },
    @{
        Pattern = '\[isDarkMode && styles\.\w+\]'
        Replacement = 'styles.container'
    },
    @{
        Pattern = 'isDarkMode=\{isDarkMode\}'
        Replacement = ''
    },
    @{
        Pattern = 'onToggleDarkMode=\{[^}]+\}'
        Replacement = ''
    }
)

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot $file
    if (Test-Path $fullPath) {
        Write-Host "Procesando: $file"
        $content = Get-Content $fullPath -Raw
        
        foreach ($rep in $replacements) {
            $content = $content -replace $rep.Pattern, $rep.Replacement
        }
        
        $content | Set-Content $fullPath -NoNewline
        Write-Host "✓ Completado: $file"
    } else {
        Write-Host "⚠ No encontrado: $file"
    }
}

Write-Host "Limpieza completada."
