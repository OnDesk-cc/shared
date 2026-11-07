/**
 * El catálogo de automatizaciones en el idioma de quien lee (Tarea 19 de la spec
 * multilingüe). Los disparadores, sus campos y las acciones salen de los
 * manifiestos de cada app y de Nova (`nova/src/flows/flow-actions.ts`) en inglés;
 * aquí se traducen al pintar:
 *
 *   - disparadores por su `type` (`orbit.task.created`), etiqueta y descripción;
 *   - acciones por su herramienta (`orbit.create_task`);
 *   - etiquetas de campo, opciones, parámetros y valores de enum por su texto inglés
 *     (se repiten mucho entre apps: «Status», «Assignee», «Urgent»).
 *
 * Lo que no está en la tabla sale como llegó: una app que añade un disparador nuevo
 * se ve en inglés hasta que alguien lo añada aquí, nunca en blanco.
 */
import type { Locale } from "../../i18n/locale";
import { paramLabel, type Catalog } from "./automations-model";

interface CatalogCopy {
	triggers: Record<string, { label: string; description: string }>;
	actions: Record<string, string>;
	texts: Record<string, string>;
}

const ES: CatalogCopy = {
	triggers: {
		"atlas.page.created": { label: "Página creada", description: "Se crea una página, a mano, desde Nova o por la API." },
		"atlas.file.uploaded": { label: "Archivo añadido", description: "Se sube un archivo, llega desde otra app o se guarda una grabación." },
		"halo.meeting.scheduled": { label: "Reunión programada", description: "Se programa una reunión, a mano, desde Nova, por la API o desde una página de reservas. No las llamadas al momento." },
		"halo.meeting.ended": { label: "Reunión terminada", description: "Termina una reunión que estaba en curso." },
		"orbit.task.created": { label: "Tarea creada", description: "Se crea una tarea, en el tablero, desde Nova o por la API." },
		"orbit.task.status_changed": { label: "Cambió el estado de la tarea", description: "Una tarea pasa a otra columna, también a terminada." },
		"orbit.task.assigned": { label: "Tarea asignada", description: "Una tarea cambia de responsable, o se queda sin él." },
		"orbit.task.commented": { label: "Tarea comentada", description: "Alguien comenta en una tarea." },
		"pulse.ticket.created": { label: "Ticket creado", description: "Se crea un ticket, por correo, a mano o por la API." },
		"pulse.ticket.status_changed": { label: "Cambió el estado del ticket", description: "Un ticket pasa a otro estado." },
		"pulse.ticket.assigned": { label: "Ticket asignado", description: "Un ticket cambia de responsable, o se queda sin él." },
		"pulse.ticket.priority_changed": { label: "Cambió la prioridad del ticket", description: "Cambia la prioridad de un ticket." },
		"pulse.ticket.message_received": { label: "El cliente respondió", description: "Llega un mensaje del cliente a un ticket." },
	},
	actions: {
		"pulse.update_ticket": "Actualizar ticket",
		"pulse.reply_ticket": "Añadir nota interna",
		"orbit.create_task": "Crear tarea",
		"orbit.update_task": "Actualizar tarea",
		"orbit.comment_task": "Comentar la tarea",
		"nexus.post_message": "Publicar mensaje",
		"halo.create_meeting": "Programar reunión",
		"atlas.create_page": "Crear página",
		"atlas.comment_document": "Comentar el documento",
	},
	texts: {
		Title: "Título", Space: "Espacio", Author: "Autor", Status: "Estado", "Link to the page": "Enlace a la página", "File name": "Nombre del archivo",
		"Uploaded by": "Subido por", "Size (bytes)": "Tamaño (bytes)", "Link to the file": "Enlace al archivo", "Starts at": "Empieza", Host: "Anfitrión",
		Participants: "Participantes", "Link to the meeting": "Enlace a la reunión", "Duration (minutes)": "Duración (minutos)", Reference: "Referencia",
		"Project key": "Clave del proyecto", Project: "Proyecto", Priority: "Prioridad", Assignee: "Responsable", "Due day": "Fecha de vencimiento",
		"Created by": "Creada por", "Link to the task": "Enlace a la tarea", "Previous status": "Estado anterior", "New status": "Estado nuevo",
		"Previous assignee": "Responsable anterior", "New assignee": "Responsable nuevo", "Comment (first 500 characters)": "Comentario (primeros 500 caracteres)",
		"Comment author": "Autor del comentario", "Ticket number": "Número de ticket", Subject: "Asunto", Channel: "Canal", Mailbox: "Buzón", Team: "Equipo",
		"Customer name": "Nombre del cliente", "Customer email": "Correo del cliente", Company: "Empresa", "Link to the ticket": "Enlace al ticket",
		"Previous priority": "Prioridad anterior", "New priority": "Prioridad nueva", "Message (first 500 characters)": "Mensaje (primeros 500 caracteres)",
		"Message sender": "Remitente del mensaje",
		Draft: "Borrador", Published: "Publicada", Archived: "Archivada", Todo: "Por hacer", "In progress": "En curso", Blocked: "Bloqueada", Done: "Terminada",
		Low: "Baja", Medium: "Media", High: "Alta", Urgent: "Urgente", Open: "Abierto", Pending: "Pendiente", Resolved: "Resuelto", Closed: "Cerrado",
		Ticket: "Ticket", Content: "Contenido", Description: "Descripción", Due: "Vencimiento", Task: "Tarea", Body: "Texto", "Start utc": "Inicio (UTC)",
		Timezone: "Zona horaria", "Duration minutes": "Duración (minutos)", Visibility: "Visibilidad", Recurrence: "Repetición", Kind: "Tipo", Id: "ID",
		Invitees: "Invitados",
		todo: "por hacer", "in progress": "en curso", blocked: "bloqueada", done: "terminada", low: "baja", medium: "media", high: "alta", urgent: "urgente",
		open: "abierto", pending: "pendiente", resolved: "resuelto", closed: "cerrado", note: "nota", reply: "respuesta", page: "página", document: "documento",
		file: "archivo", public: "pública", private: "privada", workspace: "espacio de trabajo",
	},
};

const PT: CatalogCopy = {
	triggers: {
		"atlas.page.created": { label: "Página criada", description: "Uma página é criada, à mão, pela Nova ou pela API." },
		"atlas.file.uploaded": { label: "Arquivo adicionado", description: "Um arquivo é enviado, chega de outro app ou uma gravação é salva." },
		"halo.meeting.scheduled": { label: "Reunião agendada", description: "Uma reunião é agendada, à mão, pela Nova, pela API ou por uma página de agendamento. Não as chamadas imediatas." },
		"halo.meeting.ended": { label: "Reunião encerrada", description: "Uma reunião que estava acontecendo termina." },
		"orbit.task.created": { label: "Tarefa criada", description: "Uma tarefa é criada, no quadro, pela Nova ou pela API." },
		"orbit.task.status_changed": { label: "Status da tarefa mudou", description: "Uma tarefa passa para outra coluna, inclusive concluída." },
		"orbit.task.assigned": { label: "Tarefa atribuída", description: "Uma tarefa muda de responsável, ou fica sem nenhum." },
		"orbit.task.commented": { label: "Tarefa comentada", description: "Alguém comenta em uma tarefa." },
		"pulse.ticket.created": { label: "Ticket criado", description: "Um ticket é criado, por e-mail, à mão ou pela API." },
		"pulse.ticket.status_changed": { label: "Status do ticket mudou", description: "Um ticket passa para outro status." },
		"pulse.ticket.assigned": { label: "Ticket atribuído", description: "Um ticket muda de responsável, ou fica sem nenhum." },
		"pulse.ticket.priority_changed": { label: "Prioridade do ticket mudou", description: "A prioridade de um ticket muda." },
		"pulse.ticket.message_received": { label: "O cliente respondeu", description: "Chega uma mensagem do cliente em um ticket." },
	},
	actions: {
		"pulse.update_ticket": "Atualizar ticket",
		"pulse.reply_ticket": "Adicionar nota interna",
		"orbit.create_task": "Criar tarefa",
		"orbit.update_task": "Atualizar tarefa",
		"orbit.comment_task": "Comentar a tarefa",
		"nexus.post_message": "Publicar mensagem",
		"halo.create_meeting": "Agendar reunião",
		"atlas.create_page": "Criar página",
		"atlas.comment_document": "Comentar o documento",
	},
	texts: {
		Title: "Título", Space: "Espaço", Author: "Autor", Status: "Status", "Link to the page": "Link para a página", "File name": "Nome do arquivo",
		"Uploaded by": "Enviado por", "Size (bytes)": "Tamanho (bytes)", "Link to the file": "Link para o arquivo", "Starts at": "Começa", Host: "Anfitrião",
		Participants: "Participantes", "Link to the meeting": "Link para a reunião", "Duration (minutes)": "Duração (minutos)", Reference: "Referência",
		"Project key": "Chave do projeto", Project: "Projeto", Priority: "Prioridade", Assignee: "Responsável", "Due day": "Data de vencimento",
		"Created by": "Criada por", "Link to the task": "Link para a tarefa", "Previous status": "Status anterior", "New status": "Novo status",
		"Previous assignee": "Responsável anterior", "New assignee": "Novo responsável", "Comment (first 500 characters)": "Comentário (primeiros 500 caracteres)",
		"Comment author": "Autor do comentário", "Ticket number": "Número do ticket", Subject: "Assunto", Channel: "Canal", Mailbox: "Caixa de entrada", Team: "Equipe",
		"Customer name": "Nome do cliente", "Customer email": "E-mail do cliente", Company: "Empresa", "Link to the ticket": "Link para o ticket",
		"Previous priority": "Prioridade anterior", "New priority": "Nova prioridade", "Message (first 500 characters)": "Mensagem (primeiros 500 caracteres)",
		"Message sender": "Remetente da mensagem",
		Draft: "Rascunho", Published: "Publicada", Archived: "Arquivada", Todo: "A fazer", "In progress": "Em andamento", Blocked: "Bloqueada", Done: "Concluída",
		Low: "Baixa", Medium: "Média", High: "Alta", Urgent: "Urgente", Open: "Aberto", Pending: "Pendente", Resolved: "Resolvido", Closed: "Fechado",
		Ticket: "Ticket", Content: "Conteúdo", Description: "Descrição", Due: "Vencimento", Task: "Tarefa", Body: "Texto", "Start utc": "Início (UTC)",
		Timezone: "Fuso horário", "Duration minutes": "Duração (minutos)", Visibility: "Visibilidade", Recurrence: "Repetição", Kind: "Tipo", Id: "ID",
		Invitees: "Convidados",
		todo: "a fazer", "in progress": "em andamento", blocked: "bloqueada", done: "concluída", low: "baixa", medium: "média", high: "alta", urgent: "urgente",
		open: "aberto", pending: "pendente", resolved: "resolvido", closed: "fechado", note: "nota", reply: "resposta", page: "página", document: "documento",
		file: "arquivo", public: "pública", private: "privada", workspace: "espaço de trabalho",
	},
};

const COPY: Record<Exclude<Locale, "en">, CatalogCopy> = { es: ES, pt: PT };

/** Un texto del catálogo (etiqueta de campo, opción, parámetro o valor) en `locale`; desconocido, como llegó. */
export function catalogText(text: string, locale: Locale): string {
	return locale === "en" ? text : (COPY[locale].texts[text] ?? text);
}

/** El nombre legible de un parámetro de una acción, en `locale`. */
export function paramText(name: string, locale: Locale): string {
	return catalogText(paramLabel(name), locale);
}

/** El catálogo entero en `locale` (se aplica al recibirlo, en useAutomationsCatalog). */
export function localizeCatalog(catalog: Catalog, locale: Locale): Catalog {
	if (locale === "en") return catalog;
	const copy = COPY[locale];
	const field = <F extends { label: string; options?: { value: string; label: string }[] }>(f: F): F => ({
		...f,
		label: copy.texts[f.label] ?? f.label,
		...(f.options ? { options: f.options.map((o) => ({ ...o, label: copy.texts[o.label] ?? o.label })) } : {}),
	});
	return {
		triggers: catalog.triggers.map((t) => ({
			...t,
			label: copy.triggers[t.type]?.label ?? t.label,
			description: copy.triggers[t.type]?.description ?? t.description,
			fields: t.fields.map(field),
			...(t.change ? { change: t.change.map(field) } : {}),
		})),
		actions: catalog.actions.map((a) => ({ ...a, label: copy.actions[a.tool] ?? a.label })),
	};
}
