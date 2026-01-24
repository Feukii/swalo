-- Script pour générer les codes PIN pour différents rôles
-- À exécuter depuis le container postgres

DO $$
DECLARE
    shop_uuid TEXT;
    owner_user_id TEXT;
BEGIN
    -- Trouver la première boutique
    SELECT id INTO shop_uuid FROM shops ORDER BY created_at LIMIT 1;

    -- Trouver un propriétaire existant via user_roles
    SELECT user_id INTO owner_user_id
    FROM user_roles
    WHERE role = 'OWNER'
    ORDER BY created_at
    LIMIT 1;

    IF shop_uuid IS NOT NULL AND owner_user_id IS NOT NULL THEN
        -- Code PIN OWNER
        INSERT INTO pin_invites (id, pin_code, display_name, role, shop_id, created_by, valid_from, valid_until, is_active, created_at, updated_at)
        VALUES (
            gen_random_uuid()::text,
            '0000',
            'Propriétaire',
            'OWNER',
            shop_uuid,
            owner_user_id,
            NOW(),
            NOW() + INTERVAL '30 days',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (pin_code) DO UPDATE SET is_active = true, valid_until = NOW() + INTERVAL '30 days';

        -- Code PIN MANAGER
        INSERT INTO pin_invites (id, pin_code, display_name, role, shop_id, created_by, valid_from, valid_until, is_active, created_at, updated_at)
        VALUES (
            gen_random_uuid()::text,
            '2222',
            'Manager',
            'MANAGER',
            shop_uuid,
            owner_user_id,
            NOW(),
            NOW() + INTERVAL '30 days',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (pin_code) DO UPDATE SET is_active = true, valid_until = NOW() + INTERVAL '30 days';

        -- Code PIN ADMIN
        INSERT INTO pin_invites (id, pin_code, display_name, role, shop_id, created_by, valid_from, valid_until, is_active, created_at, updated_at)
        VALUES (
            gen_random_uuid()::text,
            '9999',
            'Administrateur',
            'ADMIN',
            shop_uuid,
            owner_user_id,
            NOW(),
            NOW() + INTERVAL '30 days',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (pin_code) DO UPDATE SET is_active = true, valid_until = NOW() + INTERVAL '30 days';

        -- Code PIN EMPLOYEE
        INSERT INTO pin_invites (id, pin_code, display_name, role, shop_id, created_by, valid_from, valid_until, is_active, created_at, updated_at)
        VALUES (
            gen_random_uuid()::text,
            '1234',
            'Employé',
            'EMPLOYEE',
            shop_uuid,
            owner_user_id,
            NOW(),
            NOW() + INTERVAL '30 days',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (pin_code) DO UPDATE SET is_active = true, valid_until = NOW() + INTERVAL '30 days';

        RAISE NOTICE '=====================================';
        RAISE NOTICE 'CODES PIN CRÉÉS AVEC SUCCÈS';
        RAISE NOTICE '=====================================';
        RAISE NOTICE 'OWNER:    0000';
        RAISE NOTICE 'MANAGER:  2222';
        RAISE NOTICE 'ADMIN:    9999';
        RAISE NOTICE 'EMPLOYEE: 1234';
        RAISE NOTICE '=====================================';
    ELSE
        RAISE NOTICE 'Impossible de trouver une boutique et un propriétaire valides';
    END IF;
END $$;

-- Afficher tous les codes PIN actifs
SELECT
    pin_code as "Code PIN",
    display_name as "Nom",
    role as "Rôle",
    is_active as "Actif",
    to_char(valid_until, 'DD/MM/YYYY') as "Expire le"
FROM pin_invites
WHERE is_active = true AND deleted = false
ORDER BY role;
