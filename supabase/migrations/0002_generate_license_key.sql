-- Generates a human-friendly random license key, e.g. "K7M2-QX9F-2ATB".
-- Avoids visually ambiguous characters (0/O, 1/I/L) since a teacher may need
-- to read this off a screenshot or type it manually.
create or replace function public.generate_license_key() returns text as $$
declare
    chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    result text := '';
    i int;
begin
    for i in 1..12 loop
        if i > 1 and (i - 1) % 4 = 0 then
            result := result || '-';
        end if;
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    return result;
end;
$$ language plpgsql;
