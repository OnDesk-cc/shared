// El vocabulario de presencia en los tres idiomas: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lastSeenSentence, lastSeenShort, presenceLabel, presenceLine, shiftSentence, statusText } from "./status.ts";

const now = () => Math.floor(Date.now() / 1000);

test("sin idioma sigue hablando inglés, como antes", () => {
	assert.equal(presenceLabel({ status: "busy", activity: "meeting" }), "Busy · In meeting");
	assert.equal(lastSeenSentence(now() - 300), "Last seen 5m ago");
	assert.equal(lastSeenShort(now() - 3 * 3600), "3h");
	assert.equal(shiftSentence({ on: false, changes_at: null }), "Off shift");
});

test("estados y actividad en es y pt", () => {
	assert.equal(presenceLabel({ status: "busy", activity: "meeting" }, "es"), "Ocupado · En una reunión");
	assert.equal(presenceLabel({ status: "away", activity: null }, "pt"), "Ausente");
	assert.equal(statusText("invisible", "es").label, "Invisible");
	assert.match(statusText("online", "pt").description, /OnDesk/);
});

test("última conexión en es y pt", () => {
	assert.equal(lastSeenSentence(now() - 300, "es"), "Visto por última vez hace 5 min");
	assert.equal(lastSeenSentence(now() - 2 * 86400, "pt"), "Visto por último há 2 d");
	assert.equal(lastSeenShort(now() - 3 * 3600, "es"), "3 h");
	assert.equal(lastSeenSentence(null, "es"), null);
});

test("turno sin hora en es y pt", () => {
	assert.equal(shiftSentence({ on: true, changes_at: null }, "es"), "En turno");
	assert.equal(shiftSentence({ on: false, changes_at: null }, "pt"), "Fora do turno");
});

test("turno con vuelta mañana", () => {
	const t = new Date();
	t.setDate(t.getDate() + 1);
	t.setHours(9, 0, 0, 0);
	const at = Math.floor(t.getTime() / 1000);
	assert.match(shiftSentence({ on: false, changes_at: at }, "es") ?? "", /^Fuera de turno · vuelve mañana a las /);
	assert.match(shiftSentence({ on: false, changes_at: at }, "pt") ?? "", /^Fora do turno · volta amanhã às /);
	assert.match(shiftSentence({ on: false, changes_at: at }) ?? "", /^Off shift · back tomorrow at /);
});

test("presenceLine combina estado y turno en el idioma pedido", () => {
	assert.equal(presenceLine({ user_id: "u", status: "online", last_seen_at: null, activity: null, shift: { on: false, changes_at: null } }, "es"), "En línea · Fuera de turno");
});
