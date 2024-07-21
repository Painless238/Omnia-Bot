require('dotenv').config();

const { Client, IntentsBitField } = require('discord.js');
const moment = require('moment');
const xlsx = require('xlsx');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers
    ],
});

// Tablica do przechowywania informacji o nieobecnościach
const nieobecnosci = [];

// Prefiks komend bota
const prefiksKomendy = '!';

// Obsługa zdarzenia uruchomienia bota
client.on('ready', (c) => {
    console.log(`✔ ${c.user.username} jest online.`);
});

// Obsługa zdarzenia otrzymania wiadomości
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const trescWiadomosci = message.content.slice(prefiksKomendy.length).trim();

    // Komenda dodawania nieobecności
    if (trescWiadomosci.startsWith('n ')) {
        const tresc = trescWiadomosci.slice(2).trim();

        // Wyszukiwanie dat w formacie DD.MM.RRRR
        const daty = tresc.match(/(\d{2}\.\d{2}\.\d{4})(?: - (\d{2}\.\d{2}\.\d{4}))?/);

        if (!daty) {
            message.reply('Nieprawidłowy format daty. Użyj DD.MM.RRRR - DD.MM.RRRR lub DD.MM.RRRR.');
            return;
        }

        const dataRozpoczecia = moment(daty[1], 'DD.MM.YYYY');
        const dataZakonczenia = daty[2] ? moment(daty[2], 'DD.MM.YYYY') : dataRozpoczecia.clone();

        const notatka = tresc.replace(daty[0], '').trim();

        if (!dataRozpoczecia.isValid() || (dataZakonczenia && !dataZakonczenia.isValid())) {
            message.reply('Nieprawidłowy format daty. Użyj DD.MM.RRRR.');
            return;
        }

        // Sprawdzenie i aktualizacja lub dodanie nowej nieobecności
        let isUpdated = false;
        for (let i = 0; i < nieobecnosci.length; i++) {
            const wpis = nieobecnosci[i];
            if (wpis.uzytkownikID === message.author.id &&
                moment(wpis.dataRozpoczecia).isSame(dataRozpoczecia, 'day') &&
                moment(wpis.dataZakonczenia).isSame(dataZakonczenia, 'day')) {
                // Zaktualizuj istniejący wpis
                wpis.notatka = notatka || 'Brak notatki';
                isUpdated = true;
                break;
            }
        }

        if (!isUpdated) {
            // Dodaj nową nieobecność
            nieobecnosci.push({
                uzytkownikID: message.author.id,
                uzytkownik: message.author.username,
                dataRozpoczecia: dataRozpoczecia.toDate(),
                dataZakonczenia: dataZakonczenia.toDate(),
                notatka: notatka || 'Brak notatki',
                oryginalnaWiadomosc: message.content
            });
        }

        message.reply(isUpdated ? 'Nieobecność została zaktualizowana.' : 'Nieobecność została zapisana.');
    }

    // Komenda eksportująca dane do pliku Excel
    if (message.content === '!export') {
        const wb = xlsx.utils.book_new();
        const daneDoEksportu = [];

        nieobecnosci.forEach((nieobecnosc, index) => {
            daneDoEksportu.push([
                index + 1,
                nieobecnosc.uzytkownik,
                `${moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY')} - ${moment(nieobecnosc.dataZakonczenia).format('DD.MM.YYYY')}`,
                nieobecnosc.notatka || 'Brak notatki'
            ]);
        });

        const ws = xlsx.utils.aoa_to_sheet(daneDoEksportu);
        xlsx.utils.sheet_add_aoa(ws, [['L.p.', 'Użytkownik', 'Zakres dat', 'Notatka']], { origin: 'A1' });
        xlsx.utils.book_append_sheet(wb, ws, 'Nieobecności');

        const fileName = `Nieobecności_${moment().format('YYYY-MM-DD')}.xlsx`;
        xlsx.writeFile(wb, fileName);

        message.reply(`Nieobecności zostały wyeksportowane do pliku ${fileName}.`);
    }

    // Komenda sprawdzająca nieobecności na dzisiaj
    if (message.content.toLowerCase() === '!dziś' || message.content.toLowerCase() === '!dzis' || message.content.toLowerCase() === '!today') {
        const dzisiaj = moment().startOf('day');
        const nieobecnosciDzisiaj = nieobecnosci.filter(nieobecnosc =>
            dzisiaj.isBetween(nieobecnosc.dataRozpoczecia, nieobecnosc.dataZakonczenia, null, '[]')
        );

        if (nieobecnosciDzisiaj.length === 0) {
            message.reply('Dziś nikt nie zgłosił nieobecności.');
        } else {
            let odp = 'Dziś nieobecni będą:\n';
            nieobecnosciDzisiaj.forEach((nieobecnosc, index) => {
                const zakresDat = moment(nieobecnosc.dataRozpoczecia).isSame(moment(nieobecnosc.dataZakonczenia)) ?
                    moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY') :
                    `${moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY')} - ${moment(nieobecnosc.dataZakonczenia).format('DD.MM.YYYY')}`;
                odp += `${index + 1}. ${nieobecnosc.uzytkownik} ${zakresDat} - ${nieobecnosc.notatka || 'Brak notatki'}\n`;
            });
            message.reply(odp);
        }
    }

    // Komenda sprawdzająca nadchodzące nieobecności
    if (message.content.toLowerCase() === '!nadchodzące' || message.content.toLowerCase() === '!nadchodzace' || message.content.toLowerCase() === '!nadchodz' || message.content.toLowerCase() === '!inc') {
        const dzisiaj = moment().startOf('day');
        const nadchodzaceNieobecnosci = nieobecnosci.filter(nieobecnosc =>
            dzisiaj.isBefore(nieobecnosc.dataZakonczenia, 'day') || dzisiaj.isBetween(nieobecnosc.dataRozpoczecia, nieobecnosc.dataZakonczenia, null, '[]')
        );

        if (nadchodzaceNieobecnosci.length === 0) {
            message.reply('Brak nadchodzących nieobecności.');
        } else {
            let odp = 'Nadchodzące nieobecności:\n';
            nadchodzaceNieobecnosci.forEach((nieobecnosc, index) => {
                const zakresDat = moment(nieobecnosc.dataRozpoczecia).isSame(moment(nieobecnosc.dataZakonczenia)) ?
                    moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY') :
                    `${moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY')} - ${moment(nieobecnosc.dataZakonczenia).format('DD.MM.YYYY')}`;
                odp += `${index + 1}. ${nieobecnosc.uzytkownik} ${zakresDat} - ${nieobecnosc.notatka || 'Brak notatki'}\n`;
            });
            message.reply(odp);
        }
    }

    // Komenda wyświetlająca wpisy danego użytkownika
    if (message.content.startsWith('!wpisy ')) {
        const mention = message.mentions.users.first();

        if (!mention) {
            message.reply('Nie znaleziono użytkownika. Użyj @wzmianka.');
            return;
        }

        const wpisyUzytkownika = nieobecnosci.filter(nieobecnosc =>
            nieobecnosc.uzytkownikID === mention.id
        );

        if (wpisyUzytkownika.length === 0) {
            message.reply(`Brak nieobecności dla użytkownika ${mention.username}.`);
        } else {
            let odp = `Wpisy użytkownika ${mention.username}:\n`;
            wpisyUzytkownika.forEach((nieobecnosc, index) => {
                const zakresDat = moment(nieobecnosc.dataRozpoczecia).isSame(moment(nieobecnosc.dataZakonczenia)) ?
                    moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY') :
                    `${moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY')} - ${moment(nieobecnosc.dataZakonczenia).format('DD.MM.YYYY')}`;
                odp += `${index + 1}. ${zakresDat} - ${nieobecnosc.notatka || 'Brak notatki'}\n`;
            });
            message.reply(odp);
        }
    }

    // Komenda wyświetlająca nieobecności jutro
    if (message.content.toLowerCase() === '!jutro' || message.content.toLowerCase() === '!tomorrow') {
        const jutro = moment().add(1, 'day').startOf('day');
        const nieobecnosciJutro = nieobecnosci.filter(nieobecnosc =>
            jutro.isBetween(nieobecnosc.dataRozpoczecia, nieobecnosc.dataZakonczenia, null, '[]')
        );

        if (nieobecnosciJutro.length === 0) {
            message.reply('Jutro nikt nie zgłosił nieobecności.');
        } else {
            let odp = 'Jutro nieobecni będą:\n';
            nieobecnosciJutro.forEach((nieobecnosc, index) => {
                const zakresDat = moment(nieobecnosc.dataRozpoczecia).isSame(moment(nieobecnosc.dataZakonczenia)) ?
                    moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY') :
                    `${moment(nieobecnosc.dataRozpoczecia).format('DD.MM.YYYY')} - ${moment(nieobecnosc.dataZakonczenia).format('DD.MM.YYYY')}`;
                odp += `${index + 1}. ${nieobecnosc.uzytkownik} ${zakresDat} - ${nieobecnosc.notatka || 'Brak notatki'}\n`;
            });
            message.reply(odp);
        }
    }

    // Komenda losująca użytkownika lub wyrażenie
    if (message.content.toLowerCase() === '!jebać' || message.content.toLowerCase() === '!jebac') {
        const losuj = Math.random(); // Losowanie 0-1
        const brisingarID = 'brisingar_'; // ID użytkownika Sinkstara

        if (losuj < 0.7) { // 70% szans na pingowanie użytkownika
            const members = message.guild.members.cache.filter(member => !member.user.bot);
            const randomMember = members.random(); // Losowanie członka serwera
            if (randomMember) {
                message.reply(`<@${randomMember.id}>!`);
            } else {
                message.reply('Nie mogę znaleźć żadnego użytkownika na serwerze.');
            }
        } else { // 30% szans na pingowanie Sinkstara
            const sinkstara = message.guild.members.cache.find(member => member.user.username === 'Sinkstara' && member.user.discriminator === '0000'); // Przykład ID
            if (sinkstara) {
                message.reply(`<@${sinkstara.id}> (brisingar_)!`);
            } else {
                message.reply('Nie mogę znaleźć Sinkstara na serwerze.');
            }
        }
    }
});

client.login(process.env.TOKEN);
