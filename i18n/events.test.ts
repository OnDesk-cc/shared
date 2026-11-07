// Las frases de las notificaciones de un producto, en el idioma de cada quien: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eventParams, notificationText, parseEventParams, renderEvent, renderEventVar, type EventBook } from "./events";

const en = {
	events: {
		invited: { title: "{actor} invited you to {meeting}", description: "{when}", detailLength: "Length" },
		started: { title: "{meeting} has started" },
	},
	words: {
		somebody: "Somebody",
		noFixedTime: "No fixed time",
		startsAt: "Starts {date}",
		minutes: { one: "{count} minute", other: "{count} minutes" },
	},
};
const es: typeof en = {
	events: {
		invited: { title: "{actor} te invitó a {meeting}", description: "{when}", detailLength: "Duración" },
		started: { title: "{meeting} empezó" },
	},
	words: {
		somebody: "Alguien",
		noFixedTime: "Sin hora fija",
		startsAt: "Empieza {date}",
		minutes: { one: "{count} minuto", other: "{count} minutos" },
	},
};
const book: EventBook = { en, es, pt: en };

test("texto llano y palabras del libro, en el idioma pedido", () => {
	assert.equal(renderEvent(book, "es", "invited", "title", { actor: { word: "somebody" }, meeting: "Retro" }), "Alguien te invitó a Retro");
	assert.equal(renderEvent(book, "en", "invited", "description", { when: { word: "noFixedTime" } }), "No fixed time");
});

test("plurales dentro de una palabra", () => {
	assert.equal(renderEvent(book, "es", "invited", "detailLength", {}), "Duración");
	assert.equal(renderEvent(book, "es", "started", "title", { meeting: { word: "minutes", vars: { count: 1 } } }), "1 minuto empezó");
	assert.equal(renderEvent(book, "en", "started", "title", { meeting: { word: "minutes", vars: { count: 3 } } }), "3 minutes empezó".replace("empezó", "has started"));
});

test("una fecha se escribe en el idioma y la zona dadas, con la zona al final si se pide", () => {
	const at = Date.UTC(2026, 10, 7, 15, 30) / 1000;
	const es1 = renderEvent(book, "es", "invited", "description", { when: { word: "startsAt", vars: { date: { at, tz: "America/Mexico_City", zone: true } } } });
	assert.match(es1, /^Empieza 7 nov 2026, 9:30/);
	assert.match(es1, /\(America\/Mexico_City\)$/);
	const en1 = renderEvent(book, "en", "invited", "description", { when: { word: "startsAt", vars: { date: { at, tz: "UTC" } } } });
	assert.match(en1, /^Starts Nov 7, 2026, 3:30/);
});

test("un evento o un campo que no existen: el inglés, y si tampoco, vacío", () => {
	assert.equal(renderEvent({ en, es: { ...es, events: { ...es.events, started: {} as never } }, pt: en }, "es", "started", "title", { meeting: "Retro" }), "Retro has started");
	assert.equal(renderEvent(book, "es", "nope", "title", {}), "");
});

test("params: ida y vuelta; lo desconocido es null; la fila vieja se pinta con su texto", () => {
	const raw = eventParams("started", { meeting: "Retro", when: { at: 1, tz: "UTC" } });
	assert.deepEqual(parseEventParams(raw, book), { key: "started", vars: { meeting: "Retro", when: { at: 1, tz: "UTC" } } });
	assert.equal(parseEventParams("{", book), null);
	assert.equal(parseEventParams(JSON.stringify({ key: "nope", vars: {} }), book), null);
	assert.deepEqual(notificationText({ title: "Old", description: "Row", params: null }, "es", book), { title: "Old", description: "Row" });
	assert.equal(notificationText({ title: "x", description: "y", params: raw }, "es", book).title, "Retro empezó");
});

test("una fecha completa lleva el día de la semana; una zona que no existe cae a UTC en vez de romper", () => {
	const at = Date.UTC(2026, 10, 7, 15, 30) / 1000;
	assert.match(renderEvent(book, "es", "invited", "description", { when: { word: "startsAt", vars: { date: { at, tz: "UTC", full: true } } } }), /sábado/);
	assert.match(renderEvent(book, "en", "invited", "description", { when: { word: "startsAt", vars: { date: { at, tz: "Mars/Olympus", zone: true } } } }), /\(UTC\)$/);
});

test("renderEventVar escribe un valor suelto", () => {
	assert.equal(renderEventVar(book, "es", { word: "minutes", vars: { count: 45 } }), "45 minutos");
	assert.equal(renderEventVar(book, "en", "Retro"), "Retro");
});
