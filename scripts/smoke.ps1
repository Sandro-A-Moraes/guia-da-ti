param([string]$BaseUrl = 'http://localhost:5080')
$ErrorActionPreference = 'Stop'
$health = Invoke-RestMethod "$BaseUrl/health"
if ($health.status -ne 'ok') { throw 'Health falhou.' }
$search = Invoke-RestMethod "$BaseUrl/api/resources?q=dados&type=roadmaps"
if ($search.total -ne 1 -or $search.items[0].slug -ne 'roadmap-exemplo') { throw 'Busca falhou.' }
$accent = Invoke-RestMethod "$BaseUrl/api/resources?q=seguran%C3%A7a"
if ($accent.total -ne 1) { throw 'Busca com acento falhou.' }
$creator = Invoke-RestMethod "$BaseUrl/api/resources/creators/criador-exemplo"
if ($creator.countries -notcontains 'US' -or $creator.languages -notcontains 'en') { throw 'Idioma/região do cadastro falhou.' }
foreach ($route in @('/', '/forum/', '/comunidades/', '/cursos/curso-exemplo/', '/areas/dados/', '/tecnologias/react/')) {
    $response = Invoke-WebRequest "$BaseUrl$route" -UseBasicParsing
    if ($response.Content -notmatch '<h1' -or $response.Content -notmatch 'rel="canonical"') { throw "HTML/SEO ausente: $route" }
}
foreach ($route in @('/explorar', '/explorar/', '/cursos', '/cursos/', '/youtube', '/youtube/', '/nao-existe', '/api/resources/courses/nao-existe', '/api/resources?page=0')) {
    try { Invoke-WebRequest "$BaseUrl$route" -UseBasicParsing | Out-Null; throw "Rota deveria falhar: $route" }
    catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -notin @(400, 404)) { throw }
    }
}
$sitemap = Invoke-WebRequest "$BaseUrl/sitemap.xml" -UseBasicParsing
if ($sitemap.Content -notmatch '/tecnologias/react') { throw 'Sitemap incompleto.' }
Write-Output 'Smoke OK: health, busca, acentos, HTML, SEO, sitemap, parametros e 404.'
