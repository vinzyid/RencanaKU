<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrdVersion extends Model
{
    protected $fillable = ['project_id', 'version_number', 'content', 'status', 'ai_provider'];

    protected $casts = [
        'content' => 'array',
    ];

    /**
     * `content` disimpan sebagai longText berisi JSON lewat cast array.
     * Helper ini menjaga kontrak lama (string JSON) tetap aman dibaca.
     */
    public function decodedContent(): array
    {
        if (is_array($this->content)) {
            return $this->content;
        }

        $decoded = json_decode((string) $this->content, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function project(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function ambiguityFlags(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(AmbiguityFlag::class);
    }

    public function contradictionFlags(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ContradictionFlag::class);
    }

    public function messages(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Message::class, 'related_prd_version_id');
    }
}