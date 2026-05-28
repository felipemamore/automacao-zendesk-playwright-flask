from app.utils import normalizar_texto

def test_normalizar_texto_deve_remover_acentos_e_maiusculas():
    entrada = "Gestão de Remuneração"
    expectativa = "gestao de remuneracao"

    resultado = normalizar_texto(entrada)
    assert resultado == expectativa

def test_normalizar_texto_deve_limpar_espacos_duplos_e_quebras_de_linha():
    entrada = "BPM   \n  Workflow"
    expectativa = "bpm workflow"

    resultado = normalizar_texto(entrada)
    assert resultado == expectativa

def test_normalizar_texto_com_string_vazia_deve_retornar_vazio():
    assert normalizar_texto("") == ""