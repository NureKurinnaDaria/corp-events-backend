import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Клієнт підписується на конкретну подію
  @SubscribeMessage('joinEvent')
  handleJoinEvent(
    @MessageBody() eventId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`event:${eventId}`);
    this.logger.log(`Client ${client.id} joined event:${eventId}`);
  }

  // Клієнт відписується від події
  @SubscribeMessage('leaveEvent')
  handleLeaveEvent(
    @MessageBody() eventId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`event:${eventId}`);
    this.logger.log(`Client ${client.id} left event:${eventId}`);
  }

  // Клієнт підписується на глобальний список подій
  @SubscribeMessage('joinEventsList')
  handleJoinEventsList(@ConnectedSocket() client: Socket) {
    client.join('events-list');
    this.logger.log(`Client ${client.id} joined events-list`);
  }

  // Клієнт підписується на свої сповіщення
  @SubscribeMessage('joinUser')
  handleJoinUser(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user:${userId}`);
    this.logger.log(`Client ${client.id} joined user:${userId}`);
  }

  // Emit: статус події змінився (скасування, оновлення)
  emitEventStatusChanged(
    eventId: string,
    payload: {
      status: string;
      title: string;
    },
  ) {
    this.server.to(`event:${eventId}`).emit('eventStatusChanged', {
      eventId,
      ...payload,
    });
    this.logger.log(
      `emitEventStatusChanged → event:${eventId} status=${payload.status}`,
    );
  }

  // Emit: кількість учасників змінилась
  emitParticipantsUpdated(eventId: string, participantsCount: number) {
    this.server.to(`event:${eventId}`).emit('participantsUpdated', {
      eventId,
      participantsCount,
    });
    this.logger.log(
      `emitParticipantsUpdated → event:${eventId} count=${participantsCount}`,
    );
  }

  // Emit: оновлення лічильника в глобальному списку подій
  emitParticipantsUpdatedGlobal(eventId: string, participantsCount: number) {
    this.server.to('events-list').emit('participantsUpdatedGlobal', {
      eventId,
      participantsCount,
    });
    this.logger.log(
      `emitParticipantsUpdatedGlobal → events-list eventId=${eventId} count=${participantsCount}`,
    );
  }

  // Emit: нова подія створена — оновлюємо список у всіх клієнтів
  emitEventCreated(event: Record<string, unknown>) {
    this.server.to('events-list').emit('eventCreated', event);
    this.logger.log(`emitEventCreated → events-list eventId=${event['id']}`);
  }

  // Emit: нове сповіщення для конкретного юзера
  emitNewNotification(
    userId: string,
    notification: {
      id: string;
      title: string;
      message: string;
      type: string;
      eventId: string | null;
      createdAt: Date;
    },
  ) {
    this.server.to(`user:${userId}`).emit('newNotification', notification);
    this.logger.log(
      `emitNewNotification → user:${userId} type=${notification.type}`,
    );
  }
}
