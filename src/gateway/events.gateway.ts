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

  @SubscribeMessage('joinEvent')
  handleJoinEvent(
    @MessageBody() eventId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`event:${eventId}`);
    this.logger.log(`Client ${client.id} joined event:${eventId}`);
  }

  @SubscribeMessage('leaveEvent')
  handleLeaveEvent(
    @MessageBody() eventId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`event:${eventId}`);
    this.logger.log(`Client ${client.id} left event:${eventId}`);
  }

  @SubscribeMessage('joinEventsList')
  handleJoinEventsList(@ConnectedSocket() client: Socket) {
    client.join('events-list');
    this.logger.log(`Client ${client.id} joined events-list`);
  }

  @SubscribeMessage('joinUser')
  handleJoinUser(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user:${userId}`);
    this.logger.log(`Client ${client.id} joined user:${userId}`);
  }

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

  emitParticipantsUpdated(eventId: string, participantsCount: number) {
    this.server.to(`event:${eventId}`).emit('participantsUpdated', {
      eventId,
      participantsCount,
    });
    this.logger.log(
      `emitParticipantsUpdated → event:${eventId} count=${participantsCount}`,
    );
  }

  emitParticipantsUpdatedGlobal(eventId: string, participantsCount: number) {
    this.server.to('events-list').emit('participantsUpdatedGlobal', {
      eventId,
      participantsCount,
    });
    this.logger.log(
      `emitParticipantsUpdatedGlobal → events-list eventId=${eventId} count=${participantsCount}`,
    );
  }

  emitEventCreated(event: Record<string, unknown>) {
    this.server.to('events-list').emit('eventCreated', event);
    this.logger.log(`emitEventCreated → events-list eventId=${event['id']}`);
  }

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
