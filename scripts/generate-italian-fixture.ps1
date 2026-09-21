param(
  [string]$OutputPath = "$PSScriptRoot\..\test\fixtures\italian-synthetic.wav"
)

Add-Type -AssemblyName System.Speech
$directory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'it-IT' } | Select-Object -First 1
if (-not $voice) { throw 'Nessuna voce italiana SAPI disponibile' }
$synth.SelectVoice($voice.VoiceInfo.Name)
$synth.Rate = -1
$synth.SetOutputToWaveFile($OutputPath)
$synth.Speak('Il diario di lavoro registra una frase italiana locale.')
$synth.Dispose()
Write-Output "Generated synthetic Italian fixture with $($voice.VoiceInfo.Name): $OutputPath"
