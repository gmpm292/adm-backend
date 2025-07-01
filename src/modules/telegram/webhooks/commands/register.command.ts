/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

@Injectable()
export class RegisterCommand {
  private readonly logger = new Logger(RegisterCommand.name);
  private userStates: Map<number, UserState> = new Map();
  private stepHandlers: Record<
    RegistrationStep,
    (chatId: number, text: string, bot: TelegramBot) => Promise<void>
  >;

  constructor() {
    this.stepHandlers = {
      name: this.handleName.bind(this),
      lastName: this.handleLastName.bind(this),
      email: this.handleEmail.bind(this),
      mobile: this.handleMobile.bind(this),
      confirmation: this.handleConfirmation.bind(this),
    };
  }

  execute(bot: TelegramBot, msg: Message): void {
    const chatId = msg.chat.id;
    this.userStates.set(chatId, { currentStep: 'name' });
    this.askForName(chatId, bot);
  }

  private askForName(chatId: number, bot: TelegramBot): void {
    bot
      .sendMessage(chatId, 'Por favor, ingresa tu nombre:', {
        reply_markup: { force_reply: true },
      })
      .catch((err) =>
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

      await bot.sendMessage(chatId, 'Ahora ingresa tus apellidos (opcional):', {
        reply_markup: { force_reply: true },
      });
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

      await bot.sendMessage(chatId, 'Ingresa tu correo electrónico:', {
        reply_markup: { force_reply: true },
      });
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

      await bot.sendMessage(
        chatId,
        'Por último, ingresa tu número de teléfono:',
        {
          reply_markup: { force_reply: true },
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

      userState.mobile = text.trim();
      userState.currentStep = 'confirmation';

      await bot.sendMessage(
        chatId,
        `Por favor confirma tus datos:\n\n` +
          `Nombre: ${userState.name}\n` +
          `Apellido: ${userState.lastName || 'No proporcionado'}\n` +
          `Email: ${userState.email}\n` +
          `Teléfono: ${userState.mobile}\n\n` +
          `¿Es correcto? (Sí/No)`,
        { reply_markup: { force_reply: true } },
      );
    } catch (error) {
      this.logger.error(`Error en handleMobile: ${error.message}`);
      throw error;
    }
  }

  private async handleConfirmation(
    chatId: number,
    text: string,
    bot: TelegramBot,
  ): Promise<void> {
    try {
      if (!['sí', 'si', 's'].includes(text.toLowerCase().trim())) {
        await bot.sendMessage(
          chatId,
          'Registro cancelado. Puedes comenzar de nuevo con /register',
        );
        this.userStates.delete(chatId);
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
          `Error en los datos:\n${errorMessages.join('\n')}\n\nPor favor, comienza de nuevo.`,
        );
      } else {
        // Aquí llamarías a tu servicio createUser
        // await this.userService.createUser(userData);
        await bot.sendMessage(chatId, '¡Registro completado con éxito!');
      }
    } catch (error) {
      this.logger.error(`Error en handleConfirmation: ${error.message}`);
      await bot.sendMessage(
        chatId,
        'Ocurrió un error al procesar la confirmación. Por favor, intenta nuevamente.',
      );
    } finally {
      this.userStates.delete(chatId);
    }
  }

  public async handleReply(bot: TelegramBot, msg: Message): Promise<void> {
    if (!msg.reply_to_message || !msg.text) return;

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
      this.userStates.delete(chatId);
    }
  }
}
