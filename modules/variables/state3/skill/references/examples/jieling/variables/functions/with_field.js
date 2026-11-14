([members, name, field, value]) => ({ ...members, [name]: { ...members[name], [field]: value } })
