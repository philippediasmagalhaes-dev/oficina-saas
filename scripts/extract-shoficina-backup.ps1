param(
  [Parameter(Mandatory = $true)][string]$ZipPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = "Stop"

function Convert-DatabaseValue([object]$Value) {
  if ($Value -is [DBNull]) { return $null }
  if ($Value -is [DateTime]) { return $Value.ToUniversalTime().ToString("o") }
  return $Value
}

function Read-Rows([System.Data.OleDb.OleDbConnection]$Connection, [string]$Sql) {
  $command = $Connection.CreateCommand()
  $command.CommandText = $Sql
  $reader = $command.ExecuteReader()
  $rows = [System.Collections.Generic.List[object]]::new()
  try {
    while ($reader.Read()) {
      $row = [ordered]@{}
      for ($index = 0; $index -lt $reader.FieldCount; $index++) {
        $row[$reader.GetName($index)] = Convert-DatabaseValue $reader.GetValue($index)
      }
      $rows.Add([pscustomobject]$row)
    }
  } finally {
    $reader.Close()
    $command.Dispose()
  }
  return @($rows)
}

function Decode-Jet4Password([byte[]]$Header) {
  if ($Header.Length -lt 4096 -or [BitConverter]::ToUInt32($Header, 0x14) -ne 1) {
    throw "O banco do backup não está no formato Jet 4 esperado."
  }
  [int[]]$xor = @(0x6aba,0x37ec,0xd561,0xfa9c,0xcffa,0xe628,0x272f,0x608a,0x0568,0x367b,0xe3c9,0xb1df,0x654b,0x4313,0x3ef3,0x33b1,0xf008,0x5b79,0x24ae,0x2a7c)
  $magic = [BitConverter]::ToUInt16($Header, 0x66) -bxor $xor[18]
  $decoded = [byte[]]::new(18)
  for ($index = 0; $index -lt 18; $index++) {
    $value = [BitConverter]::ToUInt16($Header, 0x42 + (2 * $index)) -bxor $xor[$index]
    if ($value -gt 255) { $value = $value -bxor $magic }
    $decoded[$index] = $value -band 0xff
  }
  $end = [Array]::IndexOf($decoded, [byte]0)
  if ($end -lt 0) { $end = $decoded.Length }
  return [Text.Encoding]::GetEncoding(28591).GetString($decoded, 0, $end)
}

if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { throw "Arquivo de backup não encontrado." }
$resolvedZip = (Resolve-Path -LiteralPath $ZipPath).Path
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputParent = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) { throw "Pasta de saída não encontrada." }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("shoficina-import-" + [Guid]::NewGuid().ToString("N"))
[void](New-Item -ItemType Directory -Path $tempRoot)
$mdbPath = Join-Path $tempRoot "Dados.MDB"
$archive = $null
$connection = $null

try {
  $archive = [IO.Compression.ZipFile]::OpenRead($resolvedZip)
  $mdbEntries = @($archive.Entries | Where-Object { $_.FullName.Replace("\", "/") -match "(^|/)Dados\.MDB$" })
  if ($mdbEntries.Count -ne 1) { throw "O backup deve conter exatamente um Dados.MDB." }

  $source = $mdbEntries[0].Open()
  $target = [IO.File]::Create($mdbPath)
  try { $source.CopyTo($target) } finally { $target.Dispose(); $source.Dispose() }

  $header = [IO.File]::ReadAllBytes($mdbPath)
  $password = Decode-Jet4Password $header
  $connection = [Data.OleDb.OleDbConnection]::new("Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$mdbPath;Jet OLEDB:Database Password=$password;Mode=Read;")
  try { $connection.Open() } catch { throw "Não foi possível abrir o banco legado em modo somente leitura." }

  $photos = [System.Collections.Generic.List[object]]::new()
  foreach ($entry in $archive.Entries) {
    $name = [IO.Path]::GetFileName($entry.FullName)
    if ($name -notmatch "^O\d{7}\.Bmp$") { continue }
    $stream = $entry.Open()
    $memory = [IO.MemoryStream]::new()
    try {
      $stream.CopyTo($memory)
      $photos.Add([pscustomobject]@{
        fileName = $name
        sizeBytes = [int]$memory.Length
        dataBase64 = [Convert]::ToBase64String($memory.ToArray())
      })
    } finally {
      $memory.Dispose()
      $stream.Dispose()
    }
  }

  $dataset = [ordered]@{
    sourceHash = (Get-FileHash -LiteralPath $resolvedZip -Algorithm SHA256).Hash
    customers = Read-Rows $connection "SELECT CODIGO,NOME,CONTATO,CPF_CNPJ,IE_RG,ENDERECO,CEP,BAIRRO,CIDADE,UF,TELEFONE,EMAIL,OBSERVACAO,CELULAR,CADASTRADO,NUMERO,COMPLEM FROM [CLIENTES] ORDER BY CODIGO"
    vehicles = Read-Rows $connection "SELECT CODIGO,COD_CLIENTE,DESCRICAO,MARCA,MODELO,SERIE,PAT,OBSERVACOES,DATA_COMPRA,CAMPO_BOOL,CAMPO_DOUBLE FROM [EQUIPAMENTOS] ORDER BY CODIGO"
    orders = Read-Rows $connection "SELECT CODIGO,COD_CLIENTE,ENTRADA,PRONTO,SAIDA,GARANTIA,SITUACAO,V_MAO,V_PECAS,V_DESLOCA,V_TERCEIRO,V_OUTROS,COD_EQUIP,APARELHO,MARCA,MODELO,SERIE,PATRIMONIO,ACESSORIO,DEFEITO,OBS_SERVICO,LAUDO,OBS_APARELHO,KILOMET,PREVISTO,V_DESCONTOS FROM [ORDEMS] ORDER BY CODIGO"
    serviceItems = Read-Rows $connection "SELECT CODIGO,DESCRICAO,TOTAL,INICIO,FIM,TECNICO,TIPO,OS_NUM,COD_SERV,QTD,V_FRETE,V_SEGURO,V_OUTROS,CUSTO,DESCONTO FROM [OS_SERVICOS] ORDER BY CODIGO"
    partItems = Read-Rows $connection "SELECT CODIGO,DESCRICAO,COD_PECA,VALOR,TECNICO,QTD,DIA,COD_OS,CUSTO,DESCONTO FROM [OS_PECAS] ORDER BY CODIGO"
    serviceCatalog = Read-Rows $connection "SELECT CODIGO,DESCRICAO,VALOR,COMISSAO,GRUPO,CUSTO_UNT,LCP116 FROM [SERVICOS] ORDER BY CODIGO"
    statuses = Read-Rows $connection "SELECT CODIGO,NOME FROM [SITUACOES] ORDER BY CODIGO"
    photos = @($photos)
  }

  $json = $dataset | ConvertTo-Json -Depth 8 -Compress
  [IO.File]::WriteAllText($resolvedOutput, $json, [Text.UTF8Encoding]::new($false))
  Write-Output ([ordered]@{
    sourceHash = $dataset.sourceHash
    customers = $dataset.customers.Count
    vehicles = $dataset.vehicles.Count
    orders = $dataset.orders.Count
    serviceItems = $dataset.serviceItems.Count
    partItems = $dataset.partItems.Count
    serviceCatalog = $dataset.serviceCatalog.Count
    photos = $dataset.photos.Count
  } | ConvertTo-Json -Compress)
} finally {
  if ($connection) { $connection.Dispose() }
  if ($archive) { $archive.Dispose() }
  if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
  $password = $null
}
