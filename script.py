import sys
import os
from flask import Flask, render_template, request, jsonify
from playwright.sync_api import sync_playwright

# --- AJUSTE PARA PYINSTALLER ENCONTRAR O HTML/CSS ---
if getattr(sys, 'frozen', False):
    # Se estiver rodando como .exe compilado
    diretorio_raiz = sys._MEIPASS
    app = Flask(__name__,
                template_folder=os.path.join(diretorio_raiz, 'templates'),
                static_folder=os.path.join(diretorio_raiz, 'static'))
else:
    # Se estiver rodando normal no seu PyCharm
    app = Flask(__name__)


# Rota principal para carregar o HTML da interface
@app.route('/')
def home():
    return render_template('index.html')


# Rota para sincronizar a memória (Quais tickets já foram feitos/encontrados)
@app.route('/api/estado', methods=['GET'])
def obter_estado():
    processados = []
    encontrados = []

    if os.path.exists("tickets_processados.txt"):
        with open("tickets_processados.txt", "r") as f:
            processados = [linha.strip() for font_line in f if (linha := font_line.strip())]

    if os.path.exists("tickets_encontrados.txt"):
        with open("tickets_encontrados.txt", "r") as f:
            encontrados = [linha.strip() for font_line in f if (linha := font_line.strip())]

    return jsonify({"processados": processados, "encontrados": encontrados})


# Rota que executa o Playwright para UM ticket de cada vez
@app.route('/api/processar_ticket', methods=['POST'])
def processar_ticket():
    dados = request.json
    numero_ticket = dados.get('ticket')
    palavras_chave = dados.get('palavras', [])

    resultado = {
        "ticket": numero_ticket,
        "encontrado": False,
        "palavras_achadas": [],
        "erro": None
    }

    try:
        with sync_playwright() as p:
            # Conecta ao Chrome já aberto
            navegador = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            contexto = navegador.contexts[0]

            # === CORREÇÃO APLICADA AQUI ===
            # Ao invés de usar a pages[0] (que é o seu console), criamos uma NOVA aba
            pagina = contexto.new_page()

            url_ticket = f"https://cxsenior.zendesk.com/agent/tickets/{numero_ticket}"

            try:
                pagina.goto(url_ticket, wait_until="domcontentloaded", timeout=45000)
            except Exception as e:
                resultado["erro"] = "Timeout na URL"
                with open("tickets_erro_timeout.txt", "a") as f_erro:
                    f_erro.write(f"{numero_ticket}\n")
                with open("tickets_processados.txt", "a") as f_proc:
                    f_proc.write(f"{numero_ticket}\n")
                pagina.close()  # Garante o fechamento da aba se der timeout
                return jsonify(resultado)

            seletor_aba_ticket = '[data-test-id="tabs-section-nav-item-ticket"]'

            try:
                pagina.wait_for_selector(seletor_aba_ticket, timeout=10000)
            except Exception:
                pass

                # Aguarda os 8 segundos solicitados
            pagina.wait_for_timeout(8000)

            # Verifica as palavras-chave
            conteudo_pagina = pagina.inner_text("body").lower()
            palavras_encontradas = [palavra for palavra in palavras_chave if palavra in conteudo_pagina]

            if palavras_encontradas:
                resultado["encontrado"] = True
                resultado["palavras_achadas"] = palavras_encontradas
                with open("tickets_encontrados.txt", "a") as arquivo_salvar:
                    arquivo_salvar.write(f"{numero_ticket}\n")

            # === OTIMIZAÇÃO EXTRA ===
            # Não precisamos mais caçar o botão de fechar do Zendesk.
            # Como abrimos uma aba real do navegador, basta fechar a aba inteira!
            try:
                pagina.close()
            except Exception:
                pass

                # --- REGISTA NA MEMÓRIA ---
            with open("tickets_processados.txt", "a") as f_proc:
                f_proc.write(f"{numero_ticket}\n")

    except Exception as e:
        resultado["erro"] = f"Falha de conexão com o Chrome: {str(e)}"

    return jsonify(resultado)


if __name__ == '__main__':
    print("🚀 Servidor da Automação rodando em http://127.0.0.1:5000")
    app.run(debug=True)