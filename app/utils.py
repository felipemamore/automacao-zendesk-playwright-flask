import unicodedata

def normalizar_texto(texto):
    if not texto:
        return""
    texto_sem_acentos = "".join(c for c in unicodedata.normalize('NFD',
                                                                 texto) if unicodedata.category(c)!= 'Mn')
    return " ".join(texto_sem_acentos.lower().split())