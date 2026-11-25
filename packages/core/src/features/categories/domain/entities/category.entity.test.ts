import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@/categories/domain/entities/category.entity';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
import { CategorySlug } from '@/categories/domain/value-objects/category-slug.vo';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';
import { InvalidCategoryAttributeException } from '@/categories/domain/exceptions/invalid-category-attribute.exception';
import { InvalidCategoryNameException } from '@/categories/domain/exceptions/invalid-category-name.exception';
import { InvalidCategoryDescriptionException } from '@/categories/domain/exceptions/invalid-category-description.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const ID = createCategoryId('category-1');
const TENANT = createTenantId('tenant-1');

function build(status: CategoryStatus = CategoryStatus.ACTIVE): Category {
  return Category.create(ID, 'Books', CategorySlug.create('books'), TENANT, 'All books', status);
}

function fresh(status: CategoryStatus = CategoryStatus.ACTIVE): Category {
  const category = build(status);
  category.clearDomainEvents();
  return category;
}

describe('Category', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  describe('create', (): void => {
    it('creates with version 1, trimmed fields and one creation event', (): void => {
      const category = Category.create(
        ID,
        '  Books ',
        CategorySlug.create('books'),
        TENANT,
        ' All books ',
        CategoryStatus.ACTIVE,
      );
      expect(category.getId()).toBe(ID);
      expect(category.getName()).toBe('Books');
      expect(category.getSlug()).toBe('books');
      expect(category.getTenantId()).toBe(TENANT);
      expect(category.getDescription()).toBe('All books');
      expect(category.getStatus()).toBe(CategoryStatus.ACTIVE);
      expect(category.getVersion()).toBe(1);
      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toMatchObject({
        eventName: 'CategoryCreatedEvent',
        categoryId: ID,
        occurredOn: NOW,
      });
    });

    it('rejects an empty id', (): void => {
      expect((): unknown =>
        Category.create(
          '' as ReturnType<typeof createCategoryId>,
          'Books',
          CategorySlug.create('books'),
          TENANT,
          '',
          CategoryStatus.ACTIVE,
        ),
      ).toThrow(InvalidCategoryAttributeException);
    });

    it('rejects an empty tenant id', (): void => {
      expect((): unknown =>
        Category.create(
          ID,
          'Books',
          CategorySlug.create('books'),
          '  ' as ReturnType<typeof createTenantId>,
          '',
          CategoryStatus.ACTIVE,
        ),
      ).toThrow(InvalidTenantIdException);
    });

    it('rejects an invalid status', (): void => {
      expect((): unknown => build('bogus' as CategoryStatus)).toThrow(
        InvalidCategoryStatusException,
      );
    });

    it('rejects an invalid name and description', (): void => {
      expect((): unknown =>
        Category.create(ID, ' ', CategorySlug.create('b'), TENANT, '', CategoryStatus.ACTIVE),
      ).toThrow(InvalidCategoryNameException);
      expect((): unknown =>
        Category.create(
          ID,
          'B',
          CategorySlug.create('b'),
          TENANT,
          'x'.repeat(201),
          CategoryStatus.ACTIVE,
        ),
      ).toThrow(InvalidCategoryDescriptionException);
    });

    it('throws DomainException subclasses only', (): void => {
      expect((): unknown => build('bogus' as CategoryStatus)).toThrow(DomainException);
    });
  });

  describe('reconstitute', (): void => {
    it('keeps the given version and emits no event', (): void => {
      const category = Category.reconstitute({
        id: ID,
        name: CategoryName.from('Toys'),
        slug: CategorySlug.create('toys'),
        tenantId: TENANT,
        description: CategoryDescription.from(''),
        status: CategoryStatus.INACTIVE,
        version: 7,
      });
      expect(category.getName()).toBe('Toys');
      expect(category.getVersion()).toBe(7);
      expect(category.getStatus()).toBe(CategoryStatus.INACTIVE);
      expect(category.domainEvents).toHaveLength(0);
    });
  });

  describe('archive', (): void => {
    it.each([CategoryStatus.ACTIVE, CategoryStatus.INACTIVE])(
      'archives from %s, bumps version and emits CategoryArchivedEvent',
      (from: CategoryStatus): void => {
        const category = fresh(from);
        category.archive();
        expect(category.getStatus()).toBe(CategoryStatus.ARCHIVED);
        expect(category.getVersion()).toBe(2);
        expect(category.domainEvents).toHaveLength(1);
        expect(category.domainEvents[0]).toMatchObject({
          eventName: 'CategoryArchivedEvent',
          categoryId: ID,
        });
      },
    );

    it('throws when already archived and changes nothing', (): void => {
      const category = fresh(CategoryStatus.ARCHIVED);
      expect((): unknown => category.archive()).toThrow(InvalidCategoryStatusException);
      expect((): unknown => category.archive()).toThrow('Category is already archived.');
      expect(category.getVersion()).toBe(1);
      expect(category.domainEvents).toHaveLength(0);
    });
  });

  describe('unarchive', (): void => {
    it('returns to ACTIVE and bumps version', (): void => {
      const category = fresh(CategoryStatus.ARCHIVED);
      category.unarchive();
      expect(category.getStatus()).toBe(CategoryStatus.ACTIVE);
      expect(category.getVersion()).toBe(2);
    });

    it.each([CategoryStatus.ACTIVE, CategoryStatus.INACTIVE])(
      'throws from %s and changes nothing',
      (from: CategoryStatus): void => {
        const category = fresh(from);
        expect((): unknown => category.unarchive()).toThrow(
          'Only archived categories can be unarchived.',
        );
        expect(category.getStatus()).toBe(from);
        expect(category.getVersion()).toBe(1);
      },
    );
  });

  describe('updateStatus', (): void => {
    it.each([
      [CategoryStatus.ACTIVE, CategoryStatus.INACTIVE],
      [CategoryStatus.INACTIVE, CategoryStatus.ACTIVE],
      [CategoryStatus.ACTIVE, CategoryStatus.ARCHIVED],
    ])('moves %s to %s with one event', (from: CategoryStatus, to: CategoryStatus): void => {
      const category = fresh(from);
      category.updateStatus(to);
      expect(category.getStatus()).toBe(to);
      expect(category.getVersion()).toBe(2);
      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toMatchObject({
        eventName: 'CategoryStatusUpdatedEvent',
        categoryId: ID,
        newStatus: to,
      });
    });

    it.each([CategoryStatus.ACTIVE, CategoryStatus.INACTIVE, CategoryStatus.ARCHIVED])(
      'refuses any change from ARCHIVED to %s',
      (to: CategoryStatus): void => {
        const category = fresh(CategoryStatus.ARCHIVED);
        expect((): unknown => category.updateStatus(to)).toThrow(
          'Cannot change the status of an archived category.',
        );
        expect(category.getStatus()).toBe(CategoryStatus.ARCHIVED);
        expect(category.getVersion()).toBe(1);
      },
    );

    it('rejects an invalid enum value without changing state', (): void => {
      const category = fresh();
      expect((): unknown => category.updateStatus('bogus' as CategoryStatus)).toThrow(
        InvalidCategoryStatusException,
      );
      expect(category.getStatus()).toBe(CategoryStatus.ACTIVE);
      expect(category.getVersion()).toBe(1);
      expect(category.domainEvents).toHaveLength(0);
    });
  });

  describe('updateName', (): void => {
    it('updates the name, bumps version once and emits the event', (): void => {
      const category = fresh();
      category.updateName('Other');
      expect(category.getName()).toBe('Other');
      expect(category.getVersion()).toBe(2);
      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toMatchObject({
        eventName: 'CategoryNameUpdatedEvent',
        categoryId: ID,
        newName: 'Other',
      });
    });

    it('keeps the slug on rename (renaming does not change the public URL)', (): void => {
      const category = fresh();
      category.updateName('Other');
      expect(category.getSlug()).toBe('books');
    });

    it.each([[''], ['   '], ['a'.repeat(101)]])(
      'rejects invalid name %j leaving name and version unchanged',
      (input: string): void => {
        const category = fresh();
        expect((): unknown => category.updateName(input)).toThrow(InvalidCategoryNameException);
        expect(category.getName()).toBe('Books');
        expect(category.getVersion()).toBe(1);
        expect(category.domainEvents).toHaveLength(0);
      },
    );

    // FINDING: the event carries the raw input instead of the stored (trimmed) name.
    it.fails('emits the normalized name in CategoryNameUpdatedEvent', (): void => {
      const category = fresh();
      category.updateName('  Other  ');
      expect(category.getName()).toBe('Other');
      expect(category.domainEvents[0]).toMatchObject({ newName: 'Other' });
    });
  });

  describe('updateDescription', (): void => {
    it('updates the description, bumps version once and emits the event', (): void => {
      const category = fresh();
      category.updateDescription('New text');
      expect(category.getDescription()).toBe('New text');
      expect(category.getVersion()).toBe(2);
      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toMatchObject({
        eventName: 'CategoryDescriptionUpdatedEvent',
        categoryId: ID,
        newDescription: 'New text',
      });
    });

    it('rejects an over-long description leaving state unchanged', (): void => {
      const category = fresh();
      expect((): unknown => category.updateDescription('x'.repeat(201))).toThrow(
        InvalidCategoryDescriptionException,
      );
      expect(category.getDescription()).toBe('All books');
      expect(category.getVersion()).toBe(1);
      expect(category.domainEvents).toHaveLength(0);
    });

    // FINDING: the event carries the raw input instead of the stored (trimmed) description.
    it.fails('emits the normalized description in CategoryDescriptionUpdatedEvent', (): void => {
      const category = fresh();
      category.updateDescription('  New text  ');
      expect(category.getDescription()).toBe('New text');
      expect(category.domainEvents[0]).toMatchObject({ newDescription: 'New text' });
    });
  });

  describe('domain events', (): void => {
    it('returns a copy and clearDomainEvents empties the list', (): void => {
      const category = build();
      category.domainEvents.length = 0;
      expect(category.domainEvents).toHaveLength(1);
      category.clearDomainEvents();
      expect(category.domainEvents).toHaveLength(0);
    });

    it('incrementVersion adds exactly one', (): void => {
      const category = fresh();
      category.incrementVersion();
      expect(category.getVersion()).toBe(2);
    });
  });
});
