import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Organization } from './organization.entity';

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  callId: string;

  @Column()
  startedAt: Date;

  @Column({ nullable: true })
  endedAt: Date;

  @Column({ nullable: true })
  durationSec: number;

  @Column({ nullable: true })
  agentId: string;

  @Column({ nullable: true })
  customerId: string;

  @Column({ nullable: true })
  transcriptText: string;

  @Column({ nullable: true })
  transcriptUri: string;

  @Column({ nullable: true })
  transcriptSha256: string;

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true })
  summary: string;

  @Column({ nullable: true })
  classification: string; // "complaint" | "compliment" | "other"

  @Column({ nullable: true })
  sentiment: string; // "negative" | "neutral" | "positive"

  @Column({ nullable: true })
  severity: string; // "low" | "medium" | "high"

  @Column({ type: 'json', nullable: true })
  entities: JSON; // { account_id, ... }

  @Column({ type: 'json', nullable: true })
  evidence: JSON; // [{ speaker, text, start_ms, end_ms }]

  @Column({ nullable: true })
  classifierConf: number;

  @Column({ type: 'json', nullable: true })
  policyAudit: JSON; // overall + findings
  @ManyToOne(() => Organization, organization => organization.id)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization; // Which organization this call belongs to
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
