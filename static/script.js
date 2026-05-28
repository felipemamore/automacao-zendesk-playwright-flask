// --- Lógica do Modo Escuro ---
function toggleDarkMode() {
    const html = document.documentElement;
    const icon = document.getElementById('themeIcon');

    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
        icon.classList.replace('ph-sun', 'ph-moon');
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
        icon.classList.replace('ph-moon', 'ph-sun');
    }
}

if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.getElementById('themeIcon')?.classList.replace('ph-moon', 'ph-sun');
} else {
    document.documentElement.classList.remove('dark');
}

// --- Variáveis Globais ---
let ticketsEncontradosLista = [];
let listaPendentes = [];
let totalTicketsTXT = 0;
let palavrasChaveArray = [];
let indexAtual = 0;
let emExecucao = false;
let pausado = false;

// Elementos da Tela
let telaConfiguracao, telaResultados, formAutomacao, consoleArea, btnIniciar, controlesExecucao, btnPausar, consolePanel, formPanel;

// Garante que o mapeamento só ocorra com a árvore HTML pronta
document.addEventListener('DOMContentLoaded', () => {
    telaConfiguracao = document.getElementById('telaConfiguracao');
    telaResultados = document.getElementById('telaResultados');
    formAutomacao = document.getElementById('formAutomacao');
    consoleArea = document.getElementById('consoleArea');
    btnIniciar = document.getElementById('btnIniciar');
    controlesExecucao = document.getElementById('controlesExecucao');
    btnPausar = document.getElementById('btnPausar');
    consolePanel = document.getElementById('consolePanel');
    formPanel = document.getElementById('formPanel');

    if (formAutomacao) {
        formAutomacao.addEventListener('submit', iniciarFormulario);
    }
});

// FUNÇÃO TOGGLE REFORMULADA: Garante transições limpas e sem sumiço do botão
function toggleConsole() {
    if(consolePanel.classList.contains('hidden')) {
        consolePanel.classList.remove('hidden');
        formPanel.classList.remove('w-full', 'md:w-full');
        formPanel.classList.add('w-full', 'md:w-1/2');
    } else {
        consolePanel.classList.add('hidden');
        formPanel.classList.remove('w-full', 'md:w-1/2');
        formPanel.classList.add('w-full', 'md:w-full');
    }
}

// ==========================================
// FLUXO DE EXECUÇÃO E INTEGRAÇÃO FLASK
// ==========================================
async function iniciarFormulario(e) {
    e.preventDefault();

    const arquivo = document.getElementById('inputArquivo').files[0];
    const palavrasInput = document.getElementById('inputPalavras').value;

    if (!arquivo) {
        alert("Por favor, selecione um arquivo txt.");
        return;
    }

    // CORREÇÃO: Usando toLowerCase() correto do JavaScript
    palavrasChaveArray = palavrasInput.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);

    btnIniciar.classList.add('hidden');
    controlesExecucao.classList.remove('hidden');
    consoleArea.innerHTML = `<div class="text-white">--- INICIANDO ROTINA ---</div>`;

    log(`Lendo ficheiro: ${arquivo.name}...`);

    const text = await arquivo.text();
    const todosTicketsTXT = text.split(/[\n\s,]+/).map(t => t.replace('#', '').trim()).filter(t => t.length > 0);
    totalTicketsTXT = todosTicketsTXT.length;

    log(`Mapeados ${totalTicketsTXT} tickets no arquivo.`);
    log(`Sincronizando memória com o Python...`);

    try {
        const res = await fetch('/api/estado');
        const estadoServidor = await res.json();

        ticketsEncontradosLista = estadoServidor.encontrados;
        listaPendentes = todosTicketsTXT.filter(t => !estadoServidor.processados.includes(t));

        if(listaPendentes.length === 0) {
            log(`<span class="text-green-500 font-bold">✅ Todos os tickets deste arquivo já foram processados anteriormente!</span>`);
            forcarFim();
            return;
        }

        if(estadoServidor.processados.length > 0 && listaPendentes.length < totalTicketsTXT) {
            log(`<span class="text-yellow-400 font-bold">🔄 Retomando execução: ${listaPendentes.length} tickets restantes.</span>`);
        } else {
            log(`Iniciando processamento para ${listaPendentes.length} tickets.`);
        }

        indexAtual = 0;
        emExecucao = true;
        pausado = false;

        processarProximo();

    } catch(err) {
        log(`<span class="text-red-500 font-bold">❌ Erro ao conectar com o Servidor Flask. Verifique se o Python está rodando.</span>`);
        forcarFim();
    }
}

async function processarProximo() {
    if (!emExecucao || pausado) return;

    if (indexAtual < listaPendentes.length) {
        const ticket = listaPendentes[indexAtual];
        const numApresentacao = indexAtual + 1;

        log(`[${numApresentacao}/${listaPendentes.length}] A processar ticket ${ticket}...`);

        try {
            const response = await fetch('/api/processar_ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket: ticket, palavras: palavrasChaveArray })
            });
            const data = await response.json();

            if(data.erro) {
                log(`[${numApresentacao}/${listaPendentes.length}] Ticket ${ticket} -> <span class="text-red-500 font-bold">ERRO: ${data.erro}</span>`);
            } else if(data.encontrado) {
                log(`[${numApresentacao}/${listaPendentes.length}] Ticket ${ticket} -> <span class="bg-green-800 text-white px-1 rounded">ENCONTRADO (${data.palavras_achadas.join(', ')})</span>`);
                if(!ticketsEncontradosLista.includes(ticket)) {
                    ticketsEncontradosLista.push(ticket);
                }
            } else {
                log(`[${numApresentacao}/${listaPendentes.length}] Ticket ${ticket} -> <span class="text-gray-500">Nada consta.</span>`);
            }
        } catch(e) {
             log(`[${numApresentacao}/${listaPendentes.length}] Ticket ${ticket} -> <span class="text-red-500 font-bold">Falha de rede com Flask</span>`);
        }

        indexAtual++;
        processarProximo();
    } else {
        log(`<div class="text-white mt-2">--- VARREDURA CONCLUÍDA ---</div>`);
        forcarFim();
    }
}

function pausarRetomar() {
    pausado = !pausado;
    if (pausado) {
        log(`<span class="text-yellow-400 font-bold">--- EXECUÇÃO PAUSADA ---</span>`);
        btnPausar.innerHTML = '<i class="ph ph-play text-xl"></i> Retomar';
        btnPausar.classList.replace('bg-yellow-500', 'bg-emerald-500');
    } else {
        log(`<span class="text-emerald-400 font-bold">--- RETOMANDO ---</span>`);
        btnPausar.innerHTML = '<i class="ph ph-pause text-xl"></i> Pausar';
        btnPausar.classList.replace('bg-emerald-500', 'bg-yellow-500');
        processarProximo();
    }
}

function forcarFim() {
    emExecucao = false;
    pausado = false;

    if (indexAtual > 0 && indexAtual < listaPendentes.length) {
        log(`<span class="text-red-400 font-bold">--- EXECUÇÃO INTERROMPIDA ---</span>`);
    }

    setTimeout(() => { mostrarTelaResultados(); }, 800);
}

function log(msg) {
    consoleArea.innerHTML += `<div>> ${msg}</div>`;
    consoleArea.scrollTop = consoleArea.scrollHeight;
}

function mostrarTelaResultados() {
    telaConfiguracao.classList.add('hidden');
    telaConfiguracao.classList.remove('flex');
    telaResultados.classList.remove('hidden');
    telaResultados.classList.add('flex');

    document.getElementById('resumoResultados').innerText = `O sistema localizou ${ticketsEncontradosLista.length} tickets contendo as palavras.`;

    const container = document.getElementById('listaTicketsContainer');
    container.innerHTML = '';

    if (ticketsEncontradosLista.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700"><h3 class="text-xl font-bold text-gray-700 dark:text-gray-300">Nenhum ticket encontrado</h3></div>`;
    } else {
        ticketsEncontradosLista.forEach(ticket => {
            const url = `https://cxsenior.zendesk.com/agent/tickets/${ticket}`;
            const card = document.createElement('a');
            card.href = url;
            card.target = "_blank";
            card.className = "flex items-center justify-between p-4 sm:p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all group cursor-pointer no-underline";
            card.innerHTML = `
                <div class="flex items-center gap-4 sm:gap-6">
                    <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex flex-shrink-0 items-center justify-center font-bold">
                        <i class="ph ph-ticket text-2xl"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Ticket ID</span>
                        <span class="font-bold text-gray-800 dark:text-gray-100 text-lg sm:text-2xl group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-none">#${ticket}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 flex flex-shrink-0 items-center justify-center text-gray-400 dark:text-gray-300 group-hover:bg-emerald-50 dark:group-hover:text-emerald-500 transition-colors">
                        <i class="ph ph-arrow-up-right text-xl"></i>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    }
}

function voltarParaConfig() {
    telaResultados.classList.add('hidden');
    telaResultados.classList.remove('flex');
    telaConfiguracao.classList.remove('hidden');
    telaConfiguracao.classList.add('flex');
    controlesExecucao.classList.add('hidden');
    btnIniciar.classList.remove('hidden');
}

// ==========================================
// MÓDULO DE EXPORTAÇÃO
// ==========================================
const getTimestamp = () => new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];

function baixarArquivo(blob, nomeArquivo) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarTXT() {
    if (ticketsEncontradosLista.length === 0) return alert('Não há tickets para exportar.');
    baixarArquivo(new Blob([ticketsEncontradosLista.join('\n')], { type: 'text/plain' }), `tickets_${getTimestamp()}.txt`);
}

function exportarCSV() {
    if (ticketsEncontradosLista.length === 0) return alert('Não há tickets para exportar.');
    let csv = "Numero Ticket,Link de Acesso\n";
    ticketsEncontradosLista.forEach(t => csv += `${t},https://cxsenior.zendesk.com/agent/tickets/${t}\n`);
    baixarArquivo(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `relatorio_${getTimestamp()}.csv`);
}

function exportarWord() {
    if (ticketsEncontradosLista.length === 0) return alert('Não há tickets para exportar.');
    let htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body><h1 style="color: #03363d;">Relatório de Tickets</h1><table border="1" style="width: 100%;"><tr><th>ID</th><th>Link</th></tr>`;
    ticketsEncontradosLista.forEach(t => htmlDoc += `<tr><td align="center"><b>#${t}</b></td><td><a href="https://cxsenior.zendesk.com/agent/tickets/${t}">https://cxsenior.zendesk.com/agent/tickets/${t}</a></td></tr>`);
    htmlDoc += `</table></body></html>`;
    baixarArquivo(new Blob(['\ufeff', htmlDoc], { type: 'application/msword' }), `relatorio_${getTimestamp()}.doc`);
}

function exportarPDF() {
    if (ticketsEncontradosLista.length === 0) return alert('Não há tickets para exportar.');

    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    if(wasDark) html.classList.remove('dark');

    const elementoArea = document.getElementById('areaImpressaoPDF');
    const header = document.getElementById('pdfHeader');
    document.getElementById('pdfData').innerText = `Gerado em: ${new Date().toLocaleString()}`;
    header.style.display = 'block';

    html2pdf().set({
        margin: 10,
        filename: `relatorio_${getTimestamp()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(elementoArea).save().then(() => {
        header.style.display = 'none';
        if(wasDark) html.classList.add('dark');
    });
}