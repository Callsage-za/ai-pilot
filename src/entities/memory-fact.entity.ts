import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('memory_facts')
export class MemoryFact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column()
  key: string;

  @Column('text')
  value: string;

  @ManyToOne(() => Conversation, conversation => conversation.facts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;
}
