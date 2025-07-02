/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';
import { validate } from 'class-validator';
import {
  RegistrationStep,
  UserRegistrationDto,
  UserState,
} from '../../dtos/user-registration.dto';
import { ConversationFlow } from '../conversation-flow.service';

@Injectable()
export class RegisterCommand extends ConversationFlow {
  protected readonly FLOW_PREFIX = 'reg';

  private readonly logger = new Logger(RegisterCommand.name);
  private userStates: Map<number, UserState> = new Map();
  private timeouts: Map<number, NodeJS.Timeout> = new Map();
  private readonly INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos

  private stepHandlers: Record<
    RegistrationStep,
    (chatId: number, text: string, bot: TelegramBot) => Promise<void>
  >;

  constructor() {
    super();
    this.stepHandlers = {
      name: this.handleName.bind(this),
      lastName: this.handleLastName.bind(this),
      email: this.handleEmail.bind(this),
      mobile: this.handleMobile.bind(this),
      mobile_contact: this.handleContact.bind(this),
      confirmation: this.handleConfirmation.bind(this),
    };
  }

  execute(bot: TelegramBot, msg: Message): void {
    const chatId = msg.chat.id;
    this.cleanupUserState(chatId);
    this.userStates.set(chatId, { currentStep: 'name' });
    this.resetInactivityTimeout(chatId, bot);
    this.askForName(chatId, bot);
  }

  private cleanupUserState(chatId: number): void {
    const existingTimeout = this.timeouts.get(chatId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.timeouts.delete(chatId);
    }
    this.userStates.delete(chatId);
  }

  private resetInactivityTimeout(chatId: number, bot: TelegramBot): void {
    const existingTimeout = this.timeouts.get(chatId);
    if (existingTimeout) clearTimeout(existingTimeout);

    const newTimeout = setTimeout(() => {
      this.handleInactivityTimeout(chatId, bot);
    }, this.INACTIVITY_TIMEOUT);

    this.timeouts.set(chatId, newTimeout);
  }

  private async handleInactivityTimeout(
    chatId: number,
    bot: TelegramBot,
  ): Promise<void> {
    try {
      await bot.sendMessage(
        chatId,
        '⌛ No hemos recibido respuesta en mucho tiempo. Por favor, usa /register para comenzar de nuevo.',
      );
      this.cleanupUserState(chatId);
    } catch (error) {
      this.logger.error(
        `Error al manejar timeout de inactividad: ${error.message}`,
      );
    }
  }

  private async sendRegistrationMessage(
    chatId: number,
    text: string,
    bot: TelegramBot,
    replyMarkup?:
      | TelegramBot.InlineKeyboardMarkup
      | TelegramBot.ReplyKeyboardMarkup
      | TelegramBot.ForceReply
      | TelegramBot.ReplyKeyboardRemove,
  ): Promise<void> {
    try {
      const userState = this.userStates.get(chatId);
      if (!userState) return;

      const messageId = this.generateMessageId(userState.currentStep as string);
      const message = await bot.sendMessage(chatId, `${messageId} ${text}`, {
        reply_markup: replyMarkup,
        parse_mode: 'Markdown',
      });

      userState.lastMessageId = message.message_id;
    } catch (error) {
      this.logger.error(`Error al enviar mensaje: ${error.message}`);
      throw error;
    }
  }

  private askForName(chatId: number, bot: TelegramBot): void {
    this.sendRegistrationMessage(
      chatId,
      '👤 Por favor, ingresa tu nombre.\n' +
        '(solamente el nombre, sin apellidos):',
      bot,
      {
        force_reply: true,
      },
    ).catch((err) =>
      this.logger.error(`Error al solicitar nombre: ${err.message}`),
    );
  }

  private async handleName(
    chatId: number,
    text: string,
    bot: TelegramBot,
  ): Promise<void> {
    try {
      const userState = this.userStates.get(chatId);
      if (!userState) return;

      userState.name = text.trim();
      userState.currentStep = 'lastName';
      this.resetInactivityTimeout(chatId, bot);

      await this.sendRegistrationMessage(
        chatId,
        'Ahora ingresa tus apellidos (opcional):',
        bot,
        { force_reply: true },
      );
    } catch (error) {
      this.logger.error(`Error en handleName: ${error.message}`);
      throw error;
    }
  }

  private async handleLastName(
    chatId: number,
    text: string,
    bot: TelegramBot,
  ): Promise<void> {
    try {
      const userState = this.userStates.get(chatId);
      if (!userState) return;

      const trimmedText = text.trim();
      if (trimmedText && trimmedText.length >= 3) {
        userState.lastName = trimmedText;
      }
      userState.currentStep = 'email';
      this.resetInactivityTimeout(chatId, bot);

      await this.sendRegistrationMessage(
        chatId,
        '✉️ Ingresa tu correo electrónico:',
        bot,
        { force_reply: true },
      );
    } catch (error) {
      this.logger.error(`Error en handleLastName: ${error.message}`);
      throw error;
    }
  }

  private async handleEmail(
    chatId: number,
    text: string,
    bot: TelegramBot,
  ): Promise<void> {
    try {
      const userState = this.userStates.get(chatId);
      if (!userState) return;

      userState.email = text.trim();
      userState.currentStep = 'mobile';
      this.resetInactivityTimeout(chatId, bot);

      await this.sendRegistrationMessage(
        chatId,
        '📱 Por último, comparte tu número de teléfono usando el botón: ⬇️',
        bot,
        {
          keyboard: [
            [
              {
                text: '📲 Compartir mi número',
                request_contact: true,
                request_location: true,
              },
            ],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
          selective: true,
        },
      );
    } catch (error) {
      this.logger.error(`Error en handleEmail: ${error.message}`);
      throw error;
    }
  }

  private async handleMobile(
    chatId: number,
    text: string,
    bot: TelegramBot,
  ): Promise<void> {
    try {
      const userState = this.userStates.get(chatId);
      if (!userState) return;

      if (text.toLowerCase() === 'escribirlo manualmente') {
        await this.sendRegistrationMessage(
          chatId,
          'Por favor, escribe tu número de teléfono:',
          bot,
          { force_reply: true },
        );
        return;
      }

      userState.mobile = text.trim();
      userState.currentStep = 'confirmation';
      this.resetInactivityTimeout(chatId, bot);

      await this.showConfirmation(chatId, bot);
    } catch (error) {
      this.logger.error(`Error en handleMobile: ${error.message}`);
      throw error;
    }
  }

  public async handleContact(bot: TelegramBot, msg: Message): Promise<void> {
    if (!msg.contact) return;

    const chatId = msg.chat.id;
    const userState = this.userStates.get(chatId);
    if (!userState || userState.currentStep !== 'mobile') return;

    try {
      let phoneNumber = msg.contact.phone_number;
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = `+${phoneNumber}`;
      }

      userState.mobile = phoneNumber;
      userState.currentStep = 'confirmation';
      this.resetInactivityTimeout(chatId, bot);

      await this.showConfirmation(chatId, bot);
    } catch (error) {
      this.logger.error(`Error al procesar contacto: ${error.message}`);
      await bot.sendMessage(
        chatId,
        'Error al procesar tu número. Por favor, inténtalo de nuevo.',
      );
      this.cleanupUserState(chatId);
    }
  }

  private async showConfirmation(
    chatId: number,
    bot: TelegramBot,
  ): Promise<void> {
    const userState = this.userStates.get(chatId);
    if (!userState) return;

    await this.sendRegistrationMessage(
      chatId,
      `Por favor confirma tus datos:\n\n` +
        `Nombre: ${userState.name}\n` +
        `Apellidos: ${userState.lastName || 'No proporcionado'}\n` +
        `Email: ${userState.email}\n` +
        `Teléfono: ${userState.mobile}\n\n` +
        `¿Es correcto?`,
      bot,
      {
        inline_keyboard: [
          [{ text: '✅ Sí, es correcto', callback_data: 'confirm_yes' }],
          [{ text: '❌ No, corregir', callback_data: 'confirm_no' }],
        ],
      },
    );
  }

  public async handleConfirmation(
    chatId: number,
    callbackData: string,
    bot: TelegramBot,
  ): Promise<void> {
    try {
      this.resetInactivityTimeout(chatId, bot);

      if (callbackData === 'confirm_no') {
        await bot.sendMessage(
          chatId,
          'Registro cancelado. Puedes comenzar de nuevo con /register',
        );
        this.cleanupUserState(chatId);
        return;
      }

      const userState = this.userStates.get(chatId);
      if (!userState) return;

      const userData = Object.assign(new UserRegistrationDto(), userState);
      const validationErrors = await validate(userData);

      if (validationErrors.length > 0) {
        const errorMessages = validationErrors
          .map((err) => (err.constraints ? Object.values(err.constraints) : []))
          .flat();
        await bot.sendMessage(
          chatId,
          `Error en los datos:\n${errorMessages.join('\n')}\n\nPor favor, comienza de nuevo con /register.`,
        );
      } else {
        // await this.userService.createUser(userData);
        console.log('userData', userData);
        await bot.sendMessage(chatId, '¡Registro completado con éxito!');
      }
    } catch (error) {
      this.logger.error(`Error en handleConfirmation: ${error.message}`);
      await bot.sendMessage(
        chatId,
        'Ocurrió un error al procesar la confirmación. Por favor, intenta nuevamente.',
      );
    } finally {
      this.cleanupUserState(chatId);
    }
  }

  public async handleReply(bot: TelegramBot, msg: Message): Promise<void> {
    if (!msg.reply_to_message?.text || !msg.text) return;

    const chatId = msg.chat.id;
    const userState = this.userStates.get(chatId);
    if (!userState?.currentStep) return;

    try {
      await this.stepHandlers[userState.currentStep](chatId, msg.text, bot);
    } catch (error) {
      this.logger.error(
        `Error en el flujo de registro para chat ${chatId}: ${error.message}`,
      );
      await bot.sendMessage(
        chatId,
        'Ocurrió un error. Por favor, intenta nuevamente.',
      );
      this.cleanupUserState(chatId);
    }
  }
}
