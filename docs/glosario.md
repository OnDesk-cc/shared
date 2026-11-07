# Glosario de traducción — en / es / pt

Toda traducción de la plataforma (consola, apps, developers, partners, correos y
`@ondesk/shared`) sigue esta tabla. Parte de lo que ya decidió el sitio de
marketing (`ondesk/src/i18n/locales/{es,pt}`). Si hace falta un término nuevo, se
añade aquí **antes** de usarlo. Spec: `ondesk/docs/specs/2026-11-06-plataforma-multilingue.md`.

## Reglas

- **Español**: neutro latinoamericano, con «tú» (nunca «vos» ni «usted»). Verbos de botón en infinitivo («Guardar», «Cancelar»).
- **Portugués**: de Brasil, con «você». Verbos de botón en infinitivo («Salvar», «Cancelar»). «e-mail» con guion.
- **No se traducen**: OnDesk, Nexus, Atlas, Halo, Orbit, Pulse, Vault, Nova, Business Suite, Stripe y los nombres de planes (Free, Starter, Pro, Business, Enterprise).
- En portugués los productos son masculinos: «no Halo», «do Pulse», «o app».
- **Nova**: en español sin artículo y «un asistente» («Nova es un asistente de IA»); en portugués «a Nova», también «um assistente» («A Nova é um assistente de IA»). Así lo escribe el sitio.
- Mayúscula sólo al principio de la frase (estilo de oración), como en inglés.
- Nada de concatenar trozos: cada frase completa es una clave con `{placeholders}`.
- Fechas, horas, números y monedas siempre con `Intl` (`date`, `relative`, `num`).
- El texto que escribe la gente nunca se traduce.

## Términos

| en | es | pt | nota |
|---|---|---|---|
| workspace | espacio de trabajo (corto: espacio) | espaço de trabalho (corto: espaço) | «Mis espacios» / «Meus espaços» en el sitio |
| seat | acceso (en precios: «por persona») | acesso (em preços: «por pessoa») | el sitio cuenta personas, no asientos |
| member | miembro | membro | |
| owner | propietario | proprietário | rol |
| admin | administrador | administrador | rol |
| agent | agente | agente | rol y agentes de Nova |
| guest | invitado | convidado | |
| team | equipo | equipe | |
| role | rol | função | |
| permission | permiso | permissão | |
| plan | plan | plano | |
| subscription | suscripción | assinatura | |
| invoice | factura | fatura | |
| billing | facturación | cobrança | |
| credits | créditos | créditos | Nova |
| sign in / sign out | iniciar sesión / cerrar sesión | entrar / sair | |
| sign up | crear cuenta | criar conta | |
| account | cuenta | conta | |
| profile | perfil | perfil | |
| settings | configuración (en menú: «Ajustes») | configurações | |
| console | consola | console | la consola de OnDesk |
| dashboard | panel | painel | |
| invite / invitation | invitar / invitación | convidar / convite | |
| notification | notificación | notificação | |
| channel | canal | canal | Nexus |
| direct message | mensaje directo | mensagem direta | |
| thread | hilo | conversa | |
| ticket | ticket | ticket | Pulse |
| queue | cola | fila | Pulse |
| contact | contacto | contato | |
| task | tarea | tarefa | Orbit |
| project | proyecto | projeto | Orbit |
| board | tablero | quadro | Orbit |
| meeting | reunión | reunião | Halo |
| booking | reserva | agendamento | Halo |
| recording | grabación | gravação | Halo |
| file / folder | archivo / carpeta | arquivo / pasta | Atlas |
| share (verb) | compartir | compartilhar | |
| item (vault) | elemento | item | Vault |
| password | contraseña | senha | |
| two-factor | verificación en dos pasos | verificação em duas etapas | |
| automation | automatización | automação | |
| step | paso | etapa | |
| run (noun) | ejecución | execução | automatizaciones |
| trigger | disparador | gatilho | |
| condition | condición | condição | |
| search | buscar | buscar | |
| save / cancel / delete | guardar / cancelar / eliminar | salvar / cancelar / excluir | |
| edit / close / open | editar / cerrar / abrir | editar / fechar / abrir | |
| loading… | cargando… | carregando… | |
| try again | volver a intentar | tentar de novo | |
| working hours | horario laboral | horário de trabalho | |
| status (presence) | estado | status | |
| online / away / busy / offline | en línea / ausente / ocupado / desconectado | online / ausente / ocupado / offline | |
| help | ayuda | ajuda | |
| legal | legal | jurídico | pie |
| app | app | app | masculino en pt («o app»), femenino en es («la app») |
