<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrdVersion extends Model
{
    protected $fillable = ['project_id', 'version_number', 'content', 'status', 'ai_provider'];

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
}