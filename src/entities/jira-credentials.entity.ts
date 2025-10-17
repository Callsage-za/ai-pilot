import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from './organization.entity';

@Entity('jira_credentials')
@Index(['organizationId'], { unique: true }) // One set of credentials per organization
export class JiraCredentials {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @Column()
  jiraUrl: string;

  @Column()
  jiraUser: string;

  @Column()
  jiraApiKey: string;

  @Column({ nullable: true })
  projectKey: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, organization => organization.id)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;
}

