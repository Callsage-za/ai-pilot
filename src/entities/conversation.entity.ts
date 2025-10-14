import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Message } from './message.entity';
import { MemoryFact } from './memory-fact.entity';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ nullable: true })
  summary: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  title: string;

  @Column('json', { nullable: true })
  conversationState: any;

  @ManyToOne(() => User, user => user.conversations)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Organization, organization => organization.conversations)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => Message, message => message.conversation)
  messages: Message[];

  @OneToMany(() => MemoryFact, fact => fact.conversation)
  facts: MemoryFact[];
}
