require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;

const TIPI = {
  ticket_supporto: { label: 'Supporto', emoji: '🛠️', style: ButtonStyle.Primary },
  ticket_partnership: { label: 'Partnership', emoji: '🤝', style: ButtonStyle.Success },
  ticket_candidatura: { label: 'Candidatura', emoji: '📝', style: ButtonStyle.Secondary },
  ticket_moderazione: { label: 'Moderazione', emoji: '🛡️', style: ButtonStyle.Danger },
};

// ---------- Setup automatico ----------
async function setupGuild(guild) {
  try {
    await guild.channels.fetch();

    // Categoria "ticket"
    let categoria = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === '⚙️ 𝐒𝐔𝐏𝐏𝐎𝐑𝐓𝐎'
    );
    if (!categoria) {
      categoria = await guild.channels.create({
        name: 'ticket',
        type: ChannelType.GuildCategory,
      });
    }

    // Canale "ticket"
    let canale = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === '❓〢ᴀᴘʀɪ-ᴜɴ-ᴛɪᴄᴋᴇᴛ' && c.parentId === categoria.id
    );
    if (!canale) {
      canale = await guild.channels.create({
        name: 'ticket',
        type: ChannelType.GuildText,
        parent: categoria.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages],
          },
        ],
      });
    }

    // Se il messaggio con i bottoni esiste già, non lo rimanda
    const messaggi = await canale.messages.fetch({ limit: 20 });
    if (messaggi.some((m) => m.author.id === client.user.id && m.components.length > 0)) return;

    const embed = new EmbedBuilder()
      .setTitle('🎫 Apri un ticket')
      .setDescription(
        'Seleziona il tipo di ticket che vuoi aprire cliccando uno dei bottoni qui sotto.\n\n' +
          '🛠️ **Supporto** – hai bisogno di aiuto\n' +
          '🤝 **Partnership** – proposte di collaborazione\n' +
          '📝 **Candidatura** – candidati per entrare nello staff\n' +
          '🛡️ **Moderazione** – segnalazioni e questioni di moderazione'
      )
      .setColor(0x5865f2);

    const riga = new ActionRowBuilder().addComponents(
      Object.entries(TIPI).map(([id, t]) =>
        new ButtonBuilder().setCustomId(id).setLabel(t.label).setEmoji(t.emoji).setStyle(t.style)
      )
    );

    await canale.send({ embeds: [embed], components: [riga] });
    console.log(`✅ Setup completato in ${guild.name}`);
  } catch (err) {
    console.error(`Errore setup in ${guild.name}:`, err);
  }
}

async function registerIpCommand(guild) {
  try {
    const commands = await guild.commands.fetch();
    const existingCommand = commands.find((command) => command.name === 'ip');
    const commandData = {
      name: 'ip',
      description: 'Mostra l’indirizzo Minecraft e lo stato della whitelist',
    };

    if (existingCommand) {
      await existingCommand.edit(commandData);
    } else {
      await guild.commands.create(commandData);
    }
  } catch (err) {
    console.error(`Errore registrazione comando /ip in ${guild.name}:`, err);
  }
}

// Appena il bot si avvia: setup in tutti i server
client.once('clientReady', async () => {
  console.log(`✅ Online come ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await setupGuild(guild);
    await registerIpCommand(guild);
  }
});

// Appena il bot viene aggiunto a un nuovo server: setup automatico
client.on('guildCreate', async (guild) => {
  await setupGuild(guild);
  await registerIpCommand(guild);
});

// ---------- Bottoni ----------
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== 'ip') return;

    const embed = new EmbedBuilder()
      .setTitle('🎮 SuperLightMC Italia')
      .setDescription(
        '**IP del server**\n`superlightmcitalia.mineserver.lol`\n\n🔒 **Whitelist attiva**'
      )
      .setColor(0x5865f2);

    try {
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Errore durante la risposta al comando /ip:', err);
    }
    return;
  }

  if (!interaction.isButton()) return;

  try {
    // Apertura ticket
    if (TIPI[interaction.customId]) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const tipo = TIPI[interaction.customId];
      const guild = interaction.guild;
      const user = interaction.user;

      const categoria = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'ticket'
      );

      const nomeCanale = `${tipo.label.toLowerCase()}-${user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

      const esistente = guild.channels.cache.find(
        (c) => c.name === nomeCanale && c.parentId === categoria?.id
      );
      if (esistente) {
        return interaction.editReply(`❌ Hai già un ticket aperto: ${esistente}`);
      }

      const permessi = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ];
      if (STAFF_ROLE_ID) {
        permessi.push({
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      const ticket = await guild.channels.create({
        name: nomeCanale,
        type: ChannelType.GuildText,
        parent: categoria?.id,
        topic: `Ticket ${tipo.label} di ${user.tag} (${user.id})`,
        permissionOverwrites: permessi,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${tipo.emoji} Ticket – ${tipo.label}`)
        .setDescription(
          `Ciao ${user}, benvenuto nel tuo ticket!\nDescrivi la tua richiesta e lo staff ti risponderà al più presto.`
        )
        .setColor(0x57f287);

      const chiudi = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_chiudi')
          .setLabel('Chiudi ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticket.send({
        content: STAFF_ROLE_ID ? `${user} <@&${STAFF_ROLE_ID}>` : `${user}`,
        embeds: [embed],
        components: [chiudi],
      });

      return interaction.editReply(`✅ Ticket creato: ${ticket}`);
    }

    // Chiusura ticket
    if (interaction.customId === 'ticket_chiudi') {
      await interaction.reply('🔒 Il ticket verrà chiuso tra 5 secondi...');
      setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
    }
  } catch (err) {
    if (err.code === 10062 || err.code === 40060) {
      console.warn(
        `Interazione ${interaction.customId} scaduta o già gestita da un'altra istanza del bot.`
      );
      return;
    }

    console.error('Errore durante la gestione del pulsante:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ Non è stato possibile completare la richiesta.');
      } else {
        await interaction.reply({
          content: '❌ Non è stato possibile completare la richiesta.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (responseError) {
      if (responseError.code === 10062 || responseError.code === 40060) {
        console.warn(`Impossibile rispondere all'interazione ${interaction.customId}: è scaduta.`);
      } else {
        console.error('Impossibile inviare la risposta all’interazione:', responseError);
      }
    }
  }
});

client.login(process.env.TOKEN);
