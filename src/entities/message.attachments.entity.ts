import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { Message } from './message.entity';

@Entity('message_attachments')
export class MessageAttachments {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  messageId: string;

  @Column()
  type: 'audio' | 'document' | 'image' | 'video' | 'other';

  @Column()
  name: string;

  @Column()
  path: string;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ nullable: true })
  fileSize: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Message, message => message.messageAttachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;
}