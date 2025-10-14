import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Message } from './message.entity';

@Entity('info_sources')
export class InfoSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  messageId: string;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column('text')
  snippet: string;

  @Column({ nullable: true })
  score: number;

  @Column({ nullable: true })
  confidence: number;

  @Column({ nullable: true })
  key: string;

  @ManyToOne(() => Message, message => message.source)
  @JoinColumn({ name: 'messageId' })
  message: Message;
}
