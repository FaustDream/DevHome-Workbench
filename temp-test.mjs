import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Schema, DOMParser } from 'prosemirror-model';

const __dirname = dirname(fileURLToPath(import.meta.url));

globalThis.window = globalThis;
globalThis.DevHome = {
    state: { notes: [] },
    dom: {},
    storageV2: {
        KEYS: { NOTES: 'notes' },
        get() { return Promise.resolve([]); },
        set() { return Promise.resolve(); }
    },
    NOTE_TYPES: [],
    EMPTY_STATE_MESSAGES: {}
};

const code = readFileSync(resolve(__dirname, 'js/notes.js'), 'utf8');
new Function(code)();
const ns = globalThis.DevHome;

// PM available
window.PM = { Schema, DOMParser };
const note1 = { id: 'n1', content: '<p>hello world</p>' };
ns.migrateNoteDoc(note1);
console.log('with PM:', JSON.stringify(note1.doc));

// PM unavailable
window.PM = undefined;
const note2 = { id: 'n2', content: '<p>keep me</p>' };
ns.migrateNoteDoc(note2);
console.log('without PM:', JSON.stringify(note2.doc));
