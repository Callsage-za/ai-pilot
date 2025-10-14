import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Conversation } from './conversation.entity';
import { InfoSource } from './info-source.entity';
import { User } from './user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;
  @Column()
  role: string; // 'user' | 'assistant' | 'system'

  @Column('text')
  content: string;

  @Column({ nullable: true })
  originalContent: string;

  @Column({ nullable: true })
  originalLanguage: string;

  @Column({ nullable: true })
  englishContent: string;

  @CreateDateColumn()
  ts: Date;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  path: string;

  @Column('json', { nullable: true })
  attachments: any;

  @ManyToOne(() => Conversation, conversation => conversation.id, { onDelete: 'CASCADE' })
  conversation: Conversation;

  @ManyToOne(() => User, user => user.id, { nullable: true })
  user: User;

  @OneToMany(() => InfoSource, infoSource => infoSource.message)
  source: InfoSource[];
}
